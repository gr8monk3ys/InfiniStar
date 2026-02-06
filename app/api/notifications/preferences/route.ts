import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import getCurrentUser from "@/app/actions/getCurrentUser"

// Valid email digest options
const EMAIL_DIGEST_OPTIONS = ["none", "daily", "weekly"] as const

// Validation schema for notification preferences
const updatePreferencesSchema = z.object({
  emailNotifications: z.boolean().optional(),
  emailDigest: z.enum(EMAIL_DIGEST_OPTIONS).optional(),
  notifyOnNewMessage: z.boolean().optional(),
  notifyOnMention: z.boolean().optional(),
  notifyOnAIComplete: z.boolean().optional(),
})

// Helper function to validate CSRF token
function validateCsrf(request: NextRequest): boolean {
  const headerToken = request.headers.get("X-CSRF-Token")
  const cookieHeader = request.headers.get("cookie")
  let cookieToken: string | null = null

  if (cookieHeader) {
    const cookies = cookieHeader.split(";").reduce(
      (acc, cookie) => {
        const [key, value] = cookie.trim().split("=")
        acc[key] = value
        return acc
      },
      {} as Record<string, string>
    )
    cookieToken = cookies["csrf-token"] || null
  }

  return verifyCsrfToken(headerToken, cookieToken)
}

// GET /api/notifications/preferences - Get current notification preferences
export async function GET(_request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        emailNotifications: true,
        emailDigest: true,
        notifyOnNewMessage: true,
        notifyOnMention: true,
        notifyOnAIComplete: true,
        mutedConversations: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({
      preferences: {
        emailNotifications: user.emailNotifications ?? true,
        emailDigest: user.emailDigest ?? "none",
        notifyOnNewMessage: user.notifyOnNewMessage ?? true,
        notifyOnMention: user.notifyOnMention ?? true,
        notifyOnAIComplete: user.notifyOnAIComplete ?? true,
        mutedConversations: user.mutedConversations ?? [],
      },
    })
  } catch (error: unknown) {
    console.error("NOTIFICATION_PREFERENCES_GET_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/notifications/preferences - Update notification preferences
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
    const validation = updatePreferencesSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
    }

    const {
      emailNotifications,
      emailDigest,
      notifyOnNewMessage,
      notifyOnMention,
      notifyOnAIComplete,
    } = validation.data

    // Build update data - only include fields that are present
    const updateData: {
      emailNotifications?: boolean
      emailDigest?: string
      notifyOnNewMessage?: boolean
      notifyOnMention?: boolean
      notifyOnAIComplete?: boolean
    } = {}

    if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications
    if (emailDigest !== undefined) updateData.emailDigest = emailDigest
    if (notifyOnNewMessage !== undefined) updateData.notifyOnNewMessage = notifyOnNewMessage
    if (notifyOnMention !== undefined) updateData.notifyOnMention = notifyOnMention
    if (notifyOnAIComplete !== undefined) updateData.notifyOnAIComplete = notifyOnAIComplete

    // Update user notification preferences
    const updatedUser = await prisma.user.update({
      where: { id: currentUser.id },
      data: updateData,
      select: {
        emailNotifications: true,
        emailDigest: true,
        notifyOnNewMessage: true,
        notifyOnMention: true,
        notifyOnAIComplete: true,
        mutedConversations: true,
      },
    })

    return NextResponse.json({
      message: "Notification preferences updated successfully",
      preferences: {
        emailNotifications: updatedUser.emailNotifications,
        emailDigest: updatedUser.emailDigest,
        notifyOnNewMessage: updatedUser.notifyOnNewMessage,
        notifyOnMention: updatedUser.notifyOnMention,
        notifyOnAIComplete: updatedUser.notifyOnAIComplete,
        mutedConversations: updatedUser.mutedConversations,
      },
    })
  } catch (error: unknown) {
    console.error("NOTIFICATION_PREFERENCES_UPDATE_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
