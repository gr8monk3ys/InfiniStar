import { NextResponse, type NextRequest } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { z } from "zod"

import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import {
  hashFallbackPassword,
  isFallbackClerkId,
  verifyFallbackPassword,
} from "@/app/lib/fallback-auth"
import { apiLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"
import getCurrentUser from "@/app/actions/getCurrentUser"

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

// PATCH /api/profile - Update user profile
export async function PATCH(request: NextRequest) {
  try {
    // CSRF Protection
    if (!verifyCsrfToken(request.headers.get("X-CSRF-Token"), getCsrfTokenFromRequest(request))) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const currentUser = await getCurrentUser()

    if (!currentUser?.id || !currentUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const shouldChangePassword = "currentPassword" in body || "newPassword" in body

    if (shouldChangePassword) {
      const validation = changePasswordSchema.safeParse(body)

      if (!validation.success) {
        return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
      }

      const { currentPassword, newPassword } = validation.data
      const nextHashedPassword = await hashFallbackPassword(newPassword)

      if (!currentUser.clerkId || isFallbackClerkId(currentUser.clerkId)) {
        if (!currentUser.hashedPassword) {
          return NextResponse.json({ error: "Password changes are unavailable." }, { status: 400 })
        }

        const isValid = await verifyFallbackPassword(currentPassword, currentUser.hashedPassword)
        if (!isValid) {
          return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })
        }

        await prisma.user.update({
          where: { id: currentUser.id },
          data: {
            hashedPassword: nextHashedPassword,
          },
        })

        return NextResponse.json({ message: "Password changed successfully" })
      }

      const clerk = await clerkClient()
      const clerkUser = await clerk.users.getUser(currentUser.clerkId)

      if (!clerkUser.passwordEnabled) {
        return NextResponse.json(
          { error: "Set up a password on your account before changing it." },
          { status: 400 }
        )
      }

      try {
        await clerk.users.verifyPassword({
          userId: currentUser.clerkId,
          password: currentPassword,
        })
      } catch {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })
      }

      await clerk.users.updateUser(currentUser.clerkId, {
        password: newPassword,
        signOutOfOtherSessions: false,
      })

      await prisma.user.update({
        where: { id: currentUser.id },
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
      where: { id: currentUser.id },
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
  } catch (error: unknown) {
    apiLogger.error({ err: error }, "Error updating profile")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/profile - Get current user profile
export async function GET(_request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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
  } catch (error: unknown) {
    apiLogger.error({ err: error }, "Error fetching profile")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
