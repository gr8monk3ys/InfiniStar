import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { InMemoryRateLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import {
  generateSuggestions,
  getCachedSuggestions,
  type SuggestionContext,
  type SuggestionType,
} from "@/app/lib/suggestions"
import getCurrentUser from "@/app/actions/getCurrentUser"
import { type FullMessageType } from "@/app/types"

/**
 * Rate limiter for suggestions endpoint
 * 30 requests per minute to prevent abuse while allowing reasonable usage
 */
const suggestionsLimiter = new InMemoryRateLimiter(30, 60000)

/**
 * Request body schema
 */
const SuggestionsRequestSchema = z.object({
  conversationId: z.string().min(1, "Conversation ID is required"),
  type: z.enum(["continue", "reply", "question", "rephrase"]),
  partialInput: z.string().optional(),
  skipCache: z.boolean().optional(),
})

/**
 * POST /api/ai/suggestions
 *
 * Generate AI-powered suggestions for chat messages.
 * Uses Claude Haiku for fast, cost-effective suggestion generation.
 */
export async function POST(request: NextRequest) {
  // CSRF Protection
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

  if (!verifyCsrfToken(headerToken, cookieToken)) {
    return NextResponse.json(
      {
        error: "Invalid CSRF token",
        code: "CSRF_TOKEN_INVALID",
      },
      { status: 403 }
    )
  }

  // Rate limiting
  const identifier = getClientIdentifier(request)
  if (!suggestionsLimiter.check(identifier)) {
    return NextResponse.json(
      {
        error: "Too many requests. Please try again in a moment.",
        code: "RATE_LIMIT_EXCEEDED",
      },
      {
        status: 429,
        headers: {
          "Retry-After": "60",
        },
      }
    )
  }

  try {
    // Authenticate user
    const currentUser = await getCurrentUser()
    if (!currentUser?.id || !currentUser?.email) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = SuggestionsRequestSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          code: "VALIDATION_ERROR",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { conversationId, type, partialInput, skipCache } = validationResult.data

    // Verify conversation exists and user has access
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userIds: {
          has: currentUser.id,
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 10, // Get last 10 messages for context
          include: {
            sender: true,
            seen: true,
          },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found", code: "NOT_FOUND" },
        { status: 404 }
      )
    }

    // Only allow suggestions for AI conversations
    if (!conversation.isAI) {
      return NextResponse.json(
        {
          error: "Suggestions are only available for AI conversations",
          code: "INVALID_CONVERSATION_TYPE",
        },
        { status: 400 }
      )
    }

    // Build suggestion context
    // Reverse messages to get chronological order
    const messages = conversation.messages.reverse() as FullMessageType[]

    const context: SuggestionContext = {
      messages,
      partialInput: partialInput?.trim(),
    }

    // Check cache first for quick response
    if (!skipCache) {
      const cached = getCachedSuggestions(context, type as SuggestionType)
      if (cached) {
        return NextResponse.json({
          suggestions: cached.suggestions,
          type: cached.type,
          cached: true,
        })
      }
    }

    // Generate suggestions
    const result = await generateSuggestions(context, type as SuggestionType, {
      maxSuggestions: 4,
      skipCache: skipCache || false,
    })

    return NextResponse.json({
      suggestions: result.suggestions,
      type: result.type,
      cached: false,
    })
  } catch (error) {
    console.error("Suggestions API error:", error)

    // Handle specific errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          code: "VALIDATION_ERROR",
          details: error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: "Failed to generate suggestions",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS /api/ai/suggestions
 *
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token",
    },
  })
}
