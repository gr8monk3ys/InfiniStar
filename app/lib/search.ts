/**
 * Search Service
 *
 * Provides search functionality for conversations and messages
 * with advanced filtering, sorting, and pagination.
 */

import prisma from "@/app/lib/prismadb"
import type {
  AdvancedSearchFilters,
  AIPersonality,
  ConversationSearchResult,
  MessageSearchResult,
  SearchFacets,
  SearchResults,
  SearchSortBy,
  SearchSuggestion,
} from "@/app/types/search"

/**
 * Maximum length for search queries to prevent ReDoS attacks
 */
const MAX_SEARCH_QUERY_LENGTH = 100

/**
 * Maximum text length to apply highlighting (longer texts skip highlighting)
 */
const MAX_TEXT_LENGTH_FOR_HIGHLIGHT = 10000

/**
 * Escape special regex characters to prevent injection
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Highlight search term in text with markdown-style markers
 * Returns text with [hl]...[/hl] markers around matched terms
 *
 * Includes protection against ReDoS attacks by limiting input lengths
 */
export function highlightSearchTerm(text: string, query: string): string {
  if (!query || !text) return text

  // Protect against ReDoS by limiting lengths
  const safeQuery =
    query.length > MAX_SEARCH_QUERY_LENGTH ? query.substring(0, MAX_SEARCH_QUERY_LENGTH) : query

  // Skip highlighting for very long texts
  if (text.length > MAX_TEXT_LENGTH_FOR_HIGHLIGHT) {
    return text
  }

  const escapedQuery = escapeRegex(safeQuery)
  const regex = new RegExp(`(${escapedQuery})`, "gi")

  return text.replace(regex, "[hl]$1[/hl]")
}

/**
 * Build date filter for Prisma queries
 */
export function buildDateFilter(
  dateFrom?: string,
  dateTo?: string
): { gte?: Date; lte?: Date } | undefined {
  if (!dateFrom && !dateTo) return undefined

  const filter: { gte?: Date; lte?: Date } = {}

  if (dateFrom) {
    const from = new Date(dateFrom)
    if (!isNaN(from.getTime())) {
      filter.gte = from
    }
  }

  if (dateTo) {
    const to = new Date(dateTo)
    if (!isNaN(to.getTime())) {
      // Set to end of day
      to.setHours(23, 59, 59, 999)
      filter.lte = to
    }
  }

  return Object.keys(filter).length > 0 ? filter : undefined
}

/**
 * Calculate relevance score based on various factors
 */
function calculateRelevanceScore(
  text: string,
  query: string,
  factors: {
    isExactMatch?: boolean
    isTitle?: boolean
    recency?: number // Days since creation
    messageCount?: number
  }
): number {
  let score = 0
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()

  // Base score for containing the query
  if (lowerText.includes(lowerQuery)) {
    score += 10
  }

  // Bonus for exact match
  if (factors.isExactMatch || lowerText === lowerQuery) {
    score += 20
  }

  // Bonus for title/name match
  if (factors.isTitle) {
    score += 15
  }

  // Recency bonus (more recent = higher score)
  if (factors.recency !== undefined) {
    if (factors.recency <= 1) score += 10
    else if (factors.recency <= 7) score += 7
    else if (factors.recency <= 30) score += 4
    else if (factors.recency <= 90) score += 2
  }

  // Message count bonus (active conversations)
  if (factors.messageCount !== undefined) {
    if (factors.messageCount >= 100) score += 5
    else if (factors.messageCount >= 50) score += 3
    else if (factors.messageCount >= 10) score += 1
  }

  return score
}

/**
 * Get sort order for Prisma based on sortBy option
 */
function getSortOrder(sortBy: SearchSortBy): object {
  switch (sortBy) {
    case "date":
      return { lastMessageAt: "desc" as const }
    case "messageCount":
      return { messages: { _count: "desc" as const } }
    case "relevance":
    default:
      // For relevance, we sort by lastMessageAt and then filter in memory
      return { lastMessageAt: "desc" as const }
  }
}

/**
 * Search conversations with advanced filters
 */
export async function searchConversations(
  userId: string,
  filters: AdvancedSearchFilters
): Promise<{ items: ConversationSearchResult[]; count: number }> {
  const { query, dateFrom, dateTo, isAI, personality, tagIds, archived, sortBy, page, limit } =
    filters

  const escapedQuery = escapeRegex(query)
  const dateFilter = buildDateFilter(dateFrom, dateTo)
  const skip = (page - 1) * limit

  // Build where clause
  const whereClause: Record<string, unknown> = {
    users: { some: { id: userId } },
    OR: [
      { name: { contains: escapedQuery, mode: "insensitive" as const } },
      {
        messages: {
          some: {
            body: { contains: escapedQuery, mode: "insensitive" as const },
            isDeleted: false,
          },
        },
      },
    ],
  }

  // Date filter
  if (dateFilter) {
    whereClause.lastMessageAt = dateFilter
  }

  // AI filter
  if (isAI !== undefined) {
    whereClause.isAI = isAI
  }

  // Personality filter
  if (personality) {
    whereClause.aiPersonality = personality
  }

  // Tag filter
  if (tagIds && tagIds.length > 0) {
    whereClause.tags = { some: { id: { in: tagIds } } }
  }

  // Archive filter
  if (!archived) {
    whereClause.archivedBy = { isEmpty: true }
  }

  const [conversations, count] = await Promise.all([
    prisma.conversation.findMany({
      where: whereClause,
      include: {
        users: {
          where: { id: { not: userId } },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        tags: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: getSortOrder(sortBy),
      skip,
      take: limit,
    }),
    prisma.conversation.count({ where: whereClause }),
  ])

  const items: ConversationSearchResult[] = conversations.map((conv: { id: string; name: string | null; isAI: boolean; isGroup: boolean; aiPersonality: string | null; createdAt: Date; lastMessageAt: Date; users: unknown[]; _count: { messages: number }; tags: unknown[]; archivedBy: string[]; isPinned?: boolean }) => {
    const daysSinceActive = Math.floor(
      (Date.now() - conv.lastMessageAt.getTime()) / (1000 * 60 * 60 * 24)
    )

    return {
      id: conv.id,
      name: conv.name,
      isAI: conv.isAI,
      isGroup: conv.isGroup,
      aiPersonality: conv.aiPersonality,
      createdAt: conv.createdAt.toISOString(),
      lastMessageAt: conv.lastMessageAt.toISOString(),
      users: conv.users,
      messageCount: conv._count.messages,
      tags: conv.tags,
      isArchived: conv.archivedBy.includes(userId),
      relevanceScore:
        sortBy === "relevance"
          ? calculateRelevanceScore(conv.name || "", query, {
              isTitle: true,
              recency: daysSinceActive,
              messageCount: conv._count.messages,
            })
          : undefined,
    }
  })

  // Sort by relevance if needed
  if (sortBy === "relevance") {
    items.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
  }

  return { items, count }
}

/**
 * Search messages with advanced filters
 */
export async function searchMessages(
  userId: string,
  filters: AdvancedSearchFilters
): Promise<{ items: MessageSearchResult[]; count: number }> {
  const {
    query,
    dateFrom,
    dateTo,
    isAI,
    personality,
    tagIds,
    hasAttachments,
    archived,
    sortBy,
    page,
    limit,
  } = filters

  const escapedQuery = escapeRegex(query)
  const dateFilter = buildDateFilter(dateFrom, dateTo)
  const skip = (page - 1) * limit

  // Build where clause for messages
  const whereClause: Record<string, unknown> = {
    conversation: {
      users: { some: { id: userId } },
      ...(isAI !== undefined && { isAI }),
      ...(personality && { aiPersonality: personality }),
      ...(tagIds && tagIds.length > 0 && { tags: { some: { id: { in: tagIds } } } }),
      ...(!archived && { archivedBy: { isEmpty: true } }),
    },
    isDeleted: false,
    body: { contains: escapedQuery, mode: "insensitive" as const },
  }

  // Date filter
  if (dateFilter) {
    whereClause.createdAt = dateFilter
  }

  // Attachments filter
  if (hasAttachments) {
    whereClause.image = { not: null }
  }

  const [messages, count] = await Promise.all([
    prisma.message.findMany({
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
            isAI: true,
            isGroup: true,
          },
        },
      },
      orderBy: sortBy === "date" ? { createdAt: "desc" } : { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.message.count({ where: whereClause }),
  ])

  const items: MessageSearchResult[] = messages.map((msg: { id: string; body: string | null; createdAt: Date; isAI: boolean; image: string | null; sender: unknown; conversation: unknown }) => {
    const daysSinceCreated = Math.floor(
      (Date.now() - msg.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    )

    return {
      id: msg.id,
      body: msg.body || "",
      highlightedBody: highlightSearchTerm(msg.body || "", query),
      createdAt: msg.createdAt.toISOString(),
      isAI: msg.isAI,
      hasImage: !!msg.image,
      sender: msg.sender,
      conversation: msg.conversation,
      relevanceScore:
        sortBy === "relevance"
          ? calculateRelevanceScore(msg.body || "", query, {
              recency: daysSinceCreated,
            })
          : undefined,
    }
  })

  // Sort by relevance if needed
  if (sortBy === "relevance") {
    items.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
  }

  return { items, count }
}

/**
 * Get search suggestions for auto-complete
 */
export async function getSearchSuggestions(
  userId: string,
  query: string,
  limit: number = 5
): Promise<SearchSuggestion[]> {
  if (!query || query.length < 2) return []

  const escapedQuery = escapeRegex(query)
  const suggestions: SearchSuggestion[] = []

  // Search conversation names
  const conversations = await prisma.conversation.findMany({
    where: {
      users: { some: { id: userId } },
      name: { contains: escapedQuery, mode: "insensitive" as const },
      archivedBy: { isEmpty: true },
    },
    select: {
      id: true,
      name: true,
      isAI: true,
    },
    take: limit,
    orderBy: { lastMessageAt: "desc" },
  })

  conversations.forEach((conv: { id: string; name: string | null; isAI: boolean }) => {
    if (conv.name) {
      suggestions.push({
        id: `conv-${conv.id}`,
        type: "conversation",
        text: conv.name,
        context: conv.isAI ? "AI Conversation" : "Conversation",
        highlightedText: highlightSearchTerm(conv.name, query),
      })
    }
  })

  // Search tags
  const tags = await prisma.tag.findMany({
    where: {
      userId,
      name: { contains: escapedQuery, mode: "insensitive" as const },
    },
    select: {
      id: true,
      name: true,
      color: true,
    },
    take: limit,
  })

  tags.forEach((tag: { id: string; name: string; color: string }) => {
    suggestions.push({
      id: `tag-${tag.id}`,
      type: "tag",
      text: tag.name,
      context: `Tag (${tag.color})`,
      highlightedText: highlightSearchTerm(tag.name, query),
    })
  })

  // Limit total suggestions
  return suggestions.slice(0, limit * 2)
}

/**
 * Get search facets for filtering UI
 */
export async function getSearchFacets(userId: string, query?: string): Promise<SearchFacets> {
  const baseWhere: Record<string, unknown> = {
    users: { some: { id: userId } },
    archivedBy: { isEmpty: true },
  }

  if (query && query.length >= 2) {
    const escapedQuery = escapeRegex(query)
    baseWhere.OR = [
      { name: { contains: escapedQuery, mode: "insensitive" as const } },
      {
        messages: {
          some: {
            body: { contains: escapedQuery, mode: "insensitive" as const },
            isDeleted: false,
          },
        },
      },
    ]
  }

  // Get conversation type counts
  const [aiCount, humanCount] = await Promise.all([
    prisma.conversation.count({
      where: { ...baseWhere, isAI: true },
    }),
    prisma.conversation.count({
      where: { ...baseWhere, isAI: false },
    }),
  ])

  // Get personality counts
  const personalityCounts: Record<AIPersonality, number> = {
    helpful: 0,
    concise: 0,
    creative: 0,
    analytical: 0,
    empathetic: 0,
    professional: 0,
    custom: 0,
  }

  const personalityResults = await prisma.conversation.groupBy({
    by: ["aiPersonality"],
    where: { ...baseWhere, isAI: true, aiPersonality: { not: null } },
    _count: true,
  })

  personalityResults.forEach((result: { aiPersonality: string | null; _count: number }) => {
    if (result.aiPersonality && result.aiPersonality in personalityCounts) {
      personalityCounts[result.aiPersonality as AIPersonality] = result._count
    }
  })

  // Get tag counts
  const tags = await prisma.tag.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      color: true,
      _count: { select: { conversations: true } },
    },
  })

  const tagCounts = tags.map((tag: { id: string; name: string; color: string; _count: { conversations: number } }) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
    count: tag._count.conversations,
  }))

  // Get date range counts
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthStart = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [todayCount, weekCount, monthCount, totalCount] = await Promise.all([
    prisma.conversation.count({
      where: { ...baseWhere, lastMessageAt: { gte: todayStart } },
    }),
    prisma.conversation.count({
      where: { ...baseWhere, lastMessageAt: { gte: weekStart, lt: todayStart } },
    }),
    prisma.conversation.count({
      where: { ...baseWhere, lastMessageAt: { gte: monthStart, lt: weekStart } },
    }),
    prisma.conversation.count({ where: baseWhere }),
  ])

  // Get attachment count
  const attachmentCount = await prisma.message.count({
    where: {
      conversation: baseWhere,
      isDeleted: false,
      image: { not: null },
    },
  })

  return {
    conversationType: {
      ai: aiCount,
      human: humanCount,
    },
    personality: personalityCounts,
    tags: tagCounts,
    dateRanges: {
      today: todayCount,
      thisWeek: weekCount,
      thisMonth: monthCount,
      older: totalCount - todayCount - weekCount - monthCount,
    },
    hasAttachments: attachmentCount,
  }
}

/**
 * Perform advanced search with all features
 */
export async function advancedSearch(
  userId: string,
  filters: AdvancedSearchFilters
): Promise<SearchResults> {
  const startTime = Date.now()

  const [conversationResults, messageResults] = await Promise.all([
    filters.type !== "messages" ? searchConversations(userId, filters) : { items: [], count: 0 },
    filters.type !== "conversations" ? searchMessages(userId, filters) : { items: [], count: 0 },
  ])

  const totalCount = conversationResults.count + messageResults.count
  const totalPages = Math.ceil(totalCount / filters.limit)

  return {
    conversationCount: conversationResults.count,
    messageCount: messageResults.count,
    conversations: conversationResults.items,
    messages: messageResults.items,
    page: filters.page,
    limit: filters.limit,
    totalPages,
    hasMore: filters.page < totalPages,
    searchTimeMs: Date.now() - startTime,
  }
}
