import { NextResponse } from "next/server"
import { z } from "zod"

import { guard } from "@/app/lib/guarded-route"
import { apiLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"
import { PUSHER_PRESENCE_CHANNEL } from "@/app/lib/pusher-channels"
import { pusherServer } from "@/app/lib/pusher-server"
import { apiLimiter } from "@/app/lib/rate-limit"

// Validation schema
const presenceSchema = z.object({
  status: z.enum(["online", "offline", "away"]),
  customStatus: z.string().max(100, "Status too long (max 100 characters)").optional().nullable(),
  customStatusEmoji: z.string().max(10, "Emoji too long").optional().nullable(),
})

const shouldBroadcastPresence = Boolean(
  process.env.PUSHER_APP_ID && process.env.NEXT_PUBLIC_PUSHER_APP_KEY && process.env.PUSHER_SECRET
)

// PATCH /api/users/presence - Update user presence status
export const PATCH = guard(
  { limiter: apiLimiter, body: presenceSchema },
  async ({ user, body }) => {
    const { status, customStatus, customStatusEmoji } = body

    // Build update data
    const updateData: {
      presenceStatus: string
      lastSeenAt: Date
      customStatus?: string | null
      customStatusEmoji?: string | null
    } = {
      presenceStatus: status,
      lastSeenAt: new Date(),
    }

    if (customStatus !== undefined) {
      updateData.customStatus = customStatus || null
    }

    if (customStatusEmoji !== undefined) {
      updateData.customStatusEmoji = customStatusEmoji || null
    }

    // Update user presence
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    })

    // Presence persistence must not fail when realtime credentials are missing.
    if (shouldBroadcastPresence) {
      try {
        await pusherServer.trigger(PUSHER_PRESENCE_CHANNEL, "user:presence", {
          userId: user.id,
          presenceStatus: updatedUser.presenceStatus,
          lastSeenAt: updatedUser.lastSeenAt,
          customStatus: updatedUser.customStatus,
          customStatusEmoji: updatedUser.customStatusEmoji,
        })
      } catch (error) {
        apiLogger.error({ err: error }, "Error broadcasting presence")
      }
    }

    return NextResponse.json({
      message: "Presence updated successfully",
      user: {
        id: updatedUser.id,
        presenceStatus: updatedUser.presenceStatus,
        lastSeenAt: updatedUser.lastSeenAt,
        customStatus: updatedUser.customStatus,
        customStatusEmoji: updatedUser.customStatusEmoji,
      },
    })
  }
)
