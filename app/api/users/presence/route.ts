import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import getCurrentUser from "@/app/actions/getCurrentUser"

// Validation schema
const presenceSchema = z.object({
  status: z.enum(["online", "offline", "away"]),
  customStatus: z.string().max(100, "Status too long (max 100 characters)").optional().nullable(),
  customStatusEmoji: z.string().max(10, "Emoji too long").optional().nullable(),
})

// PATCH /api/users/presence - Update user presence status
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser?.id || !currentUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Validate request body
    const body = await request.json()
    const validation = presenceSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
    }

    const { status, customStatus, customStatusEmoji } = validation.data

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
      where: { id: currentUser.id },
      data: updateData,
    })

    // Trigger Pusher event for real-time presence update
    // Broadcast to all conversations the user is part of
    const userConversations = await prisma.conversation.findMany({
      where: {
        users: {
          some: {
            id: currentUser.id,
          },
        },
      },
      select: {
        id: true,
      },
    })

    // Trigger presence update for each conversation
    await Promise.all(
      userConversations.map((conversation: { id: string }) =>
        pusherServer.trigger(`conversation-${conversation.id}`, "user:presence", {
          userId: currentUser.id,
          presenceStatus: updatedUser.presenceStatus,
          lastSeenAt: updatedUser.lastSeenAt,
          customStatus: updatedUser.customStatus,
          customStatusEmoji: updatedUser.customStatusEmoji,
        })
      )
    )

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
  } catch (error: unknown) {
    console.error("PRESENCE_UPDATE_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
