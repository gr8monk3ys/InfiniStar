import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { z } from "zod"

import { getAiAccessDecision } from "@/app/lib/ai-access"
import {
  canCreateMemory,
  extractMemoriesFromMessages,
  getUserMemories,
  saveExtractedMemories,
} from "@/app/lib/ai-memory"
import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { getClientIdentifier, memoryExtractLimiter } from "@/app/lib/rate-limit"

// Validation schema for memory extraction request
const extractMemoriesSchema = z.object({
  conversationId: z.string().min(1, "Conversation ID is required"),
  autoSave: z.boolean().optional().default(false),
})

/**
 * POST /api/ai/memory/extract
 * Extract memorable information from a conversation using AI
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting - stricter for AI extraction
    const identifier = getClientIdentifier(request)
    if (!memoryExtractLimiter.check(identifier)) {
      return NextResponse.json(
        { error: "Too many extraction requests. Please try again in a minute." },
        { status: 429 }
      )
    }

    // CSRF Protection
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

    if (!verifyCsrfToken(headerToken, cookieToken)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    })
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }

    const body = await request.json()

    // Validate input
    const validationResult = extractMemoriesSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.issues[0].message }, { status: 400 })
    }

    const { conversationId, autoSave } = validationResult.data

    // Verify the conversation exists and user has access
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        users: {
          some: {
            id: currentUser.id,
          },
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 20, // Last 20 messages for context
          select: {
            body: true,
            isAI: true,
            isDeleted: true,
          },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found or access denied" },
        { status: 404 }
      )
    }

    // Filter out deleted messages and format for extraction
    const messages = conversation.messages
      .filter((msg: { isDeleted?: boolean; body?: string | null }) => !msg.isDeleted && msg.body)
      .map((msg: { isAI: boolean; body?: string | null }) => ({
        role: msg.isAI ? ("assistant" as const) : ("user" as const),
        content: msg.body || "",
      }))

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "No messages to analyze in this conversation" },
        { status: 400 }
      )
    }

    // Get existing memories for context
    const existingMemories = await getUserMemories(currentUser.id)

    const accessDecision = await getAiAccessDecision(currentUser.id)
    if (!accessDecision.allowed) {
      return NextResponse.json(
        {
          error:
            accessDecision.message ??
            "AI access is unavailable for this account right now. Please try again.",
          code: accessDecision.code,
          limits: accessDecision.limits,
        },
        { status: 402 }
      )
    }

    // Extract memories using AI
    const extractedMemories = await extractMemoriesFromMessages(
      currentUser.id,
      conversationId,
      messages,
      existingMemories
    )

    if (extractedMemories.length === 0) {
      return NextResponse.json({
        extracted: [],
        saved: 0,
        message: "No notable information found to remember from this conversation.",
      })
    }

    // If autoSave is true, save the extracted memories
    let saveResult = { saved: 0, failed: 0 }
    if (autoSave) {
      // Check capacity before saving
      const capacityInfo = await canCreateMemory(currentUser.id)
      const newMemoriesCount = extractedMemories.filter(
        (m) => !existingMemories.some((em) => em.key === m.key)
      ).length

      if (newMemoriesCount > capacityInfo.limit - capacityInfo.current) {
        return NextResponse.json(
          {
            extracted: extractedMemories,
            saved: 0,
            message: `Cannot save ${newMemoriesCount} new memories. Only ${
              capacityInfo.limit - capacityInfo.current
            } slots remaining.`,
            capacityExceeded: true,
          },
          { status: 200 }
        )
      }

      saveResult = await saveExtractedMemories(currentUser.id, extractedMemories, conversationId)
    }

    return NextResponse.json({
      extracted: extractedMemories,
      saved: saveResult.saved,
      failed: saveResult.failed,
      message: autoSave
        ? `Extracted ${extractedMemories.length} memories, saved ${saveResult.saved}.`
        : `Found ${extractedMemories.length} memories. Review and save the ones you want to keep.`,
    })
  } catch (error) {
    console.error("Error extracting memories:", error)
    return NextResponse.json(
      { error: "Failed to extract memories from conversation" },
      { status: 500 }
    )
  }
}
