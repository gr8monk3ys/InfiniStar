import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { z } from "zod"

import {
  hashFallbackPassword,
  isFallbackClerkId,
  verifyFallbackPassword,
} from "@/app/lib/fallback-auth"
import { guard } from "@/app/lib/guarded-route"
import prisma from "@/app/lib/prismadb"
import { apiLimiter, authLimiter, getClientIdentifier } from "@/app/lib/rate-limit"

// Validation schema
const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long").optional(),
  image: z.string().url("Invalid image URL").optional().nullable(),
  bio: z.string().max(500, "Bio too long (max 500 characters)").optional().nullable(),
  location: z.string().max(100, "Location too long").optional().nullable(),
  website: z
    .string()
    .url("Invalid URL")
    .max(200, "Website URL too long")
    .optional()
    .nullable()
    .or(z.literal("")),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
})

/**
 * PATCH takes two different shapes on one endpoint — a profile edit or a
 * password change — and picks between them by which keys are present, so the
 * guard only asserts "some JSON object" and the handler branches.
 */
const anyObjectSchema = z.record(z.string(), z.unknown())

// PATCH /api/profile - Update user profile
export const PATCH = guard(
  { limiter: apiLimiter, body: anyObjectSchema },
  async ({ user, body, request }) => {
    const shouldChangePassword = "currentPassword" in body || "newPassword" in body

    if (shouldChangePassword) {
      // This branch verifies a credential, so the endpoint limiter (60/min) is
      // the wrong bound for it — that is 60 password guesses a minute. Apply the
      // auth limiter (5 per 5 min) to the password path only, so ordinary
      // profile edits are not throttled to five saves per five minutes.
      // Splitting the password change onto its own route would be the cleaner
      // fix, and is worth doing when this file is next opened.
      const allowed = await authLimiter.check(getClientIdentifier(request))
      if (!allowed) {
        return NextResponse.json(
          { error: "Too many password attempts. Please try again later." },
          { status: 429, headers: { "Retry-After": "300" } }
        )
      }

      const validation = changePasswordSchema.safeParse(body)

      if (!validation.success) {
        return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
      }

      const { currentPassword, newPassword } = validation.data
      const nextHashedPassword = await hashFallbackPassword(newPassword)

      if (!user.clerkId || isFallbackClerkId(user.clerkId)) {
        // getCurrentUser() intentionally omits hashedPassword; fetch it directly here.
        const userWithPassword = await prisma.user.findUnique({
          where: { id: user.id },
          select: { hashedPassword: true },
        })

        if (!userWithPassword?.hashedPassword) {
          return NextResponse.json({ error: "Password changes are unavailable." }, { status: 400 })
        }

        const isValid = await verifyFallbackPassword(
          currentPassword,
          userWithPassword.hashedPassword
        )
        if (!isValid) {
          return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })
        }

        await prisma.user.update({
          where: { id: user.id },
          data: {
            hashedPassword: nextHashedPassword,
          },
        })

        return NextResponse.json({ message: "Password changed successfully" })
      }

      const clerk = await clerkClient()
      const clerkUser = await clerk.users.getUser(user.clerkId)

      if (!clerkUser.passwordEnabled) {
        return NextResponse.json(
          { error: "Set up a password on your account before changing it." },
          { status: 400 }
        )
      }

      try {
        await clerk.users.verifyPassword({
          userId: user.clerkId,
          password: currentPassword,
        })
      } catch {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })
      }

      await clerk.users.updateUser(user.clerkId, {
        password: newPassword,
        signOutOfOtherSessions: false,
      })

      await prisma.user.update({
        where: { id: user.id },
        data: {
          hashedPassword: nextHashedPassword,
        },
      })

      return NextResponse.json({ message: "Password changed successfully" })
    }

    const validation = updateProfileSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
    }

    const { name, image, bio, location, website } = validation.data

    // Build update data
    const updateData: {
      name?: string
      image?: string | null
      bio?: string | null
      location?: string | null
      website?: string | null
    } = {}
    if (name !== undefined) updateData.name = name
    if (image !== undefined) updateData.image = image || null
    if (bio !== undefined) updateData.bio = bio || null
    if (location !== undefined) updateData.location = location || null
    if (website !== undefined) updateData.website = website || null

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        bio: true,
        location: true,
        website: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      message: "Profile updated successfully",
      user: updatedUser,
    })
  }
)

// GET /api/profile - Get current user profile
export const GET = guard({ limiter: apiLimiter }, async ({ user: currentUser }) => {
  const user = await prisma.user.findUnique({
    where: { id: currentUser.id },
    select: {
      id: true,
      clerkId: true,
      name: true,
      email: true,
      image: true,
      bio: true,
      location: true,
      website: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
      hashedPassword: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const shouldLoadClerkUser =
    Boolean(process.env.CLERK_SECRET_KEY) && user.clerkId && !isFallbackClerkId(user.clerkId)
  const clerkUser = shouldLoadClerkUser
    ? await (await clerkClient()).users.getUser(user.clerkId!)
    : null

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      bio: user.bio,
      location: user.location,
      website: user.website,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    authMode: isFallbackClerkId(user.clerkId) ? "fallback" : "clerk",
    hasBackupPassword: Boolean(user.hashedPassword),
    hasPassword: clerkUser?.passwordEnabled ?? Boolean(user.hashedPassword),
    twoFactorEnabled: clerkUser?.twoFactorEnabled ?? false,
  })
})
