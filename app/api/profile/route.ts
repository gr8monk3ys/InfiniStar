import { NextResponse, type NextRequest } from "next/server"
import bcrypt from "bcrypt"
import { z } from "zod"

import { verifyCsrfToken } from "@/app/lib/csrf"
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
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "Password must be at least 8 characters").optional(),
})

// Helper function to validate CSRF token
function validateCsrf(request: NextRequest): boolean {
  const headerToken = request.headers.get("X-CSRF-Token")
  const cookieHeader = request.headers.get("cookie")
  let cookieToken: string | null = null

  if (cookieHeader) {
    const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split("=")
      acc[key] = value
      return acc
    }, {} as Record<string, string>)
    cookieToken = cookies["csrf-token"] || null
  }

  return verifyCsrfToken(headerToken, cookieToken)
}

// PATCH /api/profile - Update user profile
export async function PATCH(request: NextRequest) {
  try {
    // CSRF Protection
    if (!validateCsrf(request)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const currentUser = await getCurrentUser()

    if (!currentUser?.id || !currentUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validation = updateProfileSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0].message }, { status: 400 })
    }

    const { name, image, bio, location, website, currentPassword, newPassword } = validation.data

    // If changing password, verify current password
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required to set new password" },
          { status: 400 }
        )
      }

      // Get user with hashed password
      const userWithPassword = await prisma.user.findUnique({
        where: { id: currentUser.id },
        select: { hashedPassword: true },
      })

      if (!userWithPassword?.hashedPassword) {
        return NextResponse.json(
          { error: "Cannot change password for OAuth accounts" },
          { status: 400 }
        )
      }

      const isCorrectPassword = await bcrypt.compare(
        currentPassword,
        userWithPassword.hashedPassword
      )

      if (!isCorrectPassword) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })
      }
    }

    // Build update data
    const updateData: {
      name?: string
      image?: string | null
      bio?: string | null
      location?: string | null
      website?: string | null
      hashedPassword?: string
    } = {}
    if (name !== undefined) updateData.name = name
    if (image !== undefined) updateData.image = image || null
    if (bio !== undefined) updateData.bio = bio || null
    if (location !== undefined) updateData.location = location || null
    if (website !== undefined) updateData.website = website || null

    // Hash new password if provided
    if (newPassword) {
      updateData.hashedPassword = await bcrypt.hash(newPassword, 12)
    }

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
    console.error("PROFILE_UPDATE_ERROR", error)
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
        name: true,
        email: true,
        image: true,
        bio: true,
        location: true,
        website: true,
        emailVerified: true,
        twoFactorEnabled: true,
        hashedPassword: true, // Used to check if user has a password
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Return user without sensitive fields
    const { hashedPassword, ...safeUser } = user
    return NextResponse.json({
      user: safeUser,
      hasPassword: !!hashedPassword,
      twoFactorEnabled: user.twoFactorEnabled,
    })
  } catch (error: unknown) {
    console.error("PROFILE_GET_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
