import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import {
  buildExportData,
  exportConversation,
  generateExportFilename,
  getContentTypeAndExtension,
} from "@/app/lib/export"
import prisma from "@/app/lib/prismadb"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"
import { isValidExportFormat, type ExportFormat } from "@/app/types/export"

interface IParams {
  conversationId?: string
}

/**
 * Zod schema for query parameter validation
 */
const exportQuerySchema = z.object({
  format: z.enum(["markdown", "json", "txt"]).default("markdown"),
})

/**
 * GET /api/conversations/[conversationId]/export
 *
 * Export a conversation in the specified format (markdown, json, or txt).
 * User must be authenticated and a participant in the conversation.
 *
 * Query Parameters:
 * - format: 'markdown' | 'json' | 'txt' (default: 'markdown')
 *
 * Returns:
 * - File download with appropriate content-type headers
 * - 401 if not authenticated
 * - 403 if not a participant in the conversation
 * - 404 if conversation not found
 * - 400 if invalid format parameter
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<IParams> }
): Promise<NextResponse> {
  // Rate limiting
  const identifier = getClientIdentifier(request)
  const allowed = await Promise.resolve(apiLimiter.check(identifier))
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many export requests. Please try again later.", success: false },
      { status: 429, headers: { "Retry-After": "60" } }
    )
  }

  try {
    const { conversationId } = await params
    const currentUser = await getCurrentUser()

    // Authentication check
    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 })
    }

    // Validate conversationId
    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation ID is required", success: false },
        { status: 400 }
      )
    }

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams
    const formatParam = searchParams.get("format") || "markdown"

    // Validate format using both Zod and type guard
    if (!isValidExportFormat(formatParam)) {
      return NextResponse.json(
        {
          error: "Invalid format parameter. Must be one of: markdown, json, txt",
          success: false,
        },
        { status: 400 }
      )
    }

    const queryValidation = exportQuerySchema.safeParse({ format: formatParam })
    if (!queryValidation.success) {
      return NextResponse.json(
        {
          error: "Invalid format parameter. Must be one of: markdown, json, txt",
          success: false,
        },
        { status: 400 }
      )
    }

    const format = queryValidation.data.format as ExportFormat

    // Fetch conversation with users and messages
    // Use cursor-based pagination for large conversations
    const conversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        messages: {
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    })

    // Check if conversation exists
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found", success: false }, { status: 404 })
    }

    // Verify user is a participant in the conversation
    const isParticipant = conversation.users.some(
      (user: { id: string }) => user.id === currentUser.id
    )
    if (!isParticipant) {
      return NextResponse.json(
        { error: "You do not have permission to export this conversation", success: false },
        { status: 403 }
      )
    }

    // Build export data using utility function
    const exportData = buildExportData(
      {
        id: conversation.id,
        name: conversation.name,
        isAI: conversation.isAI,
        aiModel: conversation.aiModel,
        aiPersonality: conversation.aiPersonality,
        users: conversation.users,
      },
      conversation.messages.map(
        (m: {
          id: string
          body: string | null
          createdAt: Date
          isAI: boolean
          isDeleted: boolean
          sender: { id: string; name: string | null; email: string | null }
        }) => ({
          id: m.id,
          body: m.body,
          createdAt: m.createdAt,
          isAI: m.isAI,
          isDeleted: m.isDeleted,
          sender: m.sender,
        })
      ),
      currentUser.id
    )

    // Convert to requested format
    const content = exportConversation(exportData, format)

    // Get content type and extension
    const { contentType, extension: _extension } = getContentTypeAndExtension(format)

    // Generate filename
    const filename = generateExportFilename(exportData.conversationName, format)

    // Return response with appropriate headers for download
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    })
  } catch (error) {
    console.error("Export conversation error:", error)
    return NextResponse.json(
      { error: "Failed to export conversation", success: false },
      { status: 500 }
    )
  }
}
