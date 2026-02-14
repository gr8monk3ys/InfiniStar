import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import { getPusherConversationChannel } from "@/app/lib/pusher-channels"
import { sanitizeMessage } from "@/app/lib/sanitize"
import getCurrentUser from "@/app/actions/getCurrentUser"

// Validation schemas
const editMessageSchema = z.object({
  body: z.string().min(1, "Message cannot be empty").max(5000, "Message too long"),
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

// PATCH /api/messages/[messageId] - Edit a message
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    // CSRF Protection
    if (!validateCsrf(request)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const currentUser = await getCurrentUser()
    const { messageId } = await params

    if (!currentUser?.id || !currentUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Validate request body
    const body = await request.json()
    const validation = editMessageSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
    }

    // Find the message
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { sender: true },
    })

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    // Check if user is the sender
    if (message.senderId !== currentUser.id) {
      return NextResponse.json({ error: "You can only edit your own messages" }, { status: 403 })
    }

    // Check if message is already deleted
    if (message.isDeleted) {
      return NextResponse.json({ error: "Cannot edit deleted message" }, { status: 400 })
    }

    // Check if message is an AI message (shouldn't be editable)
    if (message.isAI) {
      return NextResponse.json({ error: "Cannot edit AI messages" }, { status: 400 })
    }

    // Sanitize and update the message
    const sanitizedBody = sanitizeMessage(validation.data.body)

    // Ensure sanitized content is not empty
    if (!sanitizedBody.trim()) {
      return NextResponse.json(
        { error: "Message cannot be empty after sanitization" },
        { status: 400 }
      )
    }

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        body: sanitizedBody,
        editedAt: new Date(),
      },
      include: {
        sender: true,
        seen: true,
      },
    })

    // Trigger Pusher event for real-time update
    await pusherServer.trigger(
      getPusherConversationChannel(message.conversationId),
      "message:update",
      updatedMessage
    )

    return NextResponse.json(updatedMessage)
  } catch (error: unknown) {
    console.error("MESSAGE_EDIT_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/messages/[messageId] - Delete a message (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    // CSRF Protection
    if (!validateCsrf(request)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const currentUser = await getCurrentUser()
    const { messageId } = await params

    if (!currentUser?.id || !currentUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Find the message
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { sender: true },
    })

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    // Check if user is the sender
    if (message.senderId !== currentUser.id) {
      return NextResponse.json({ error: "You can only delete your own messages" }, { status: 403 })
    }

    // Check if message is already deleted
    if (message.isDeleted) {
      return NextResponse.json({ error: "Message already deleted" }, { status: 400 })
    }

    // Soft delete the message
    const deletedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        body: null, // Clear the message content
        image: null, // Clear any image
      },
      include: {
        sender: true,
        seen: true,
      },
    })

    // Trigger Pusher event for real-time update
    await pusherServer.trigger(
      getPusherConversationChannel(message.conversationId),
      "message:delete",
      deletedMessage
    )

    return NextResponse.json(deletedMessage)
  } catch (error: unknown) {
    console.error("MESSAGE_DELETE_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
