import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import prisma from "@/app/lib/prismadb"
import getCurrentUser from "@/app/actions/getCurrentUser"

// Validation schema
const searchSchema = z.object({
  query: z.string().min(1, "Search query is required").max(200),
  conversationId: z.string().optional(), // Optional: search within specific conversation
})

// GET /api/messages/search - Search messages
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser?.id || !currentUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get search params from URL
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("query")
    const conversationId = searchParams.get("conversationId")

    // Validate query
    const validation = searchSchema.safeParse({
      query,
      conversationId: conversationId || undefined,
    })

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
    }

    const { query: searchQuery, conversationId: searchConversationId } = validation.data

    // Build where clause
    const whereClause: {
      body: { contains: string; mode: "insensitive" }
      isDeleted: boolean
      conversationId?: string | { in: string[] }
    } = {
      body: {
        contains: searchQuery,
        mode: "insensitive",
      },
      isDeleted: false, // Don't search deleted messages
    }

    // If searching within specific conversation
    if (searchConversationId) {
      // Verify user has access to this conversation
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: searchConversationId,
          users: {
            some: {
              id: currentUser.id,
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

      whereClause.conversationId = searchConversationId
    } else {
      // Search across all user's conversations
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

      whereClause.conversationId = {
        in: userConversations.map((c) => c.id),
      }
    }

    // Search messages
    const messages = await prisma.message.findMany({
      where: whereClause,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        conversation: {
          select: {
            id: true,
            name: true,
            isGroup: true,
            users: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50, // Limit to 50 results
    })

    return NextResponse.json({
      messages,
      count: messages.length,
      query: searchQuery,
    })
  } catch (error: unknown) {
    console.error("MESSAGE_SEARCH_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
