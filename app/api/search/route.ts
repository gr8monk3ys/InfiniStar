import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import { advancedSearch, getSearchFacets, getSearchSuggestions } from "@/app/lib/search"
import {
  DEFAULT_SEARCH_FILTERS,
  MAX_SEARCH_LIMIT,
  MIN_QUERY_LENGTH,
  type AdvancedSearchFilters,
  type AdvancedSearchResponse,
  type AIPersonality,
  type SearchResultType,
  type SearchSortBy,
  type SearchSuggestionsResponse,
} from "@/app/types/search"

/**
 * GET /api/search
 *
 * Advanced search endpoint with filtering, sorting, and faceted search.
 * Searches across conversations and messages the user has access to.
 *
 * Query Parameters:
 * - query: Search term (required, min 2 characters)
 * - type: "all", "conversations", or "messages" (default: "all")
 * - dateFrom: Filter by start date (ISO string, optional)
 * - dateTo: Filter by end date (ISO string, optional)
 * - isAI: Filter by AI conversations ("true" or "false", optional)
 * - personality: Filter by AI personality (optional)
 * - tagIds: Filter by tag IDs (comma-separated, optional)
 * - hasAttachments: Filter messages with images ("true" or "false", optional)
 * - archived: Include archived conversations ("true" or "false", default: "false")
 * - sortBy: "relevance", "date", or "messageCount" (default: "relevance")
 * - page: Page number, 1-indexed (default: 1)
 * - limit: Results per page (default: 20, max: 50)
 * - includeFacets: Include search facets ("true" or "false", default: "false")
 *
 * Legacy support:
 * - q: Alternative to query
 * - offset: Convert to page number
 * - conversationType: Convert to isAI filter
 */
export async function GET(request: NextRequest): Promise<NextResponse<AdvancedSearchResponse>> {
  // Rate limiting
  const identifier = getClientIdentifier(request)
  if (!apiLimiter.check(identifier)) {
    return NextResponse.json(
      {
        success: false,
        error: "Too many requests. Please try again later.",
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
    // Authentication
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized. Please log in to search.",
        },
        { status: 401 }
      )
    }

    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    })
    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found.",
        },
        { status: 401 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const filters = parseSearchFilters(searchParams)

    // Validate search query
    if (!filters.query || filters.query.length < MIN_QUERY_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          error: `Search query must be at least ${MIN_QUERY_LENGTH} characters.`,
        },
        { status: 400 }
      )
    }

    // Perform search
    const results = await advancedSearch(currentUser.id, filters)

    // Include facets if requested
    const includeFacets = searchParams.get("includeFacets") === "true"
    let facets = undefined

    if (includeFacets) {
      facets = await getSearchFacets(currentUser.id, filters.query)
    }

    return NextResponse.json({
      success: true,
      data: results,
      facets,
    })
  } catch (error) {
    console.error("[SEARCH_ERROR]", error)
    return NextResponse.json(
      {
        success: false,
        error: "An error occurred while searching. Please try again.",
      },
      { status: 500 }
    )
  }
}

/**
 * Parse and validate search filters from query parameters
 * Supports both new and legacy parameter formats
 */
function parseSearchFilters(params: URLSearchParams): AdvancedSearchFilters {
  // Support both 'query' and legacy 'q' parameter
  const query = (params.get("query") || params.get("q"))?.trim() || ""

  // Type filter
  const typeParam = params.get("type") as SearchResultType | null
  const type: SearchResultType =
    typeParam && ["all", "conversations", "messages"].includes(typeParam)
      ? typeParam
      : DEFAULT_SEARCH_FILTERS.type

  // Date filters
  const dateFrom = params.get("dateFrom") || undefined
  const dateTo = params.get("dateTo") || undefined

  // AI filter - support both new 'isAI' and legacy 'conversationType'
  let isAI: boolean | undefined
  const isAIParam = params.get("isAI")
  const conversationType = params.get("conversationType")

  if (isAIParam === "true") {
    isAI = true
  } else if (isAIParam === "false") {
    isAI = false
  } else if (conversationType === "ai") {
    isAI = true
  } else if (conversationType === "human") {
    isAI = false
  }

  // Personality filter
  const personalityParam = params.get("personality") as AIPersonality | null
  const validPersonalities: AIPersonality[] = [
    "helpful",
    "concise",
    "creative",
    "analytical",
    "empathetic",
    "professional",
    "custom",
  ]
  const personality =
    personalityParam && validPersonalities.includes(personalityParam) ? personalityParam : undefined

  // Tag filter - support comma-separated list or single tagId
  const tagIdsParam = params.get("tagIds")
  const tagIdParam = params.get("tagId")
  let tagIds: string[] | undefined

  if (tagIdsParam) {
    tagIds = tagIdsParam.split(",").filter(Boolean)
  } else if (tagIdParam) {
    tagIds = [tagIdParam]
  }

  // Attachments filter
  const hasAttachments = params.get("hasAttachments") === "true" ? true : undefined

  // Archive filter
  const archived = params.get("archived") === "true"

  // Sort filter
  const sortByParam = params.get("sortBy") as SearchSortBy | null
  const validSortOptions: SearchSortBy[] = ["relevance", "date", "messageCount"]
  const sortBy =
    sortByParam && validSortOptions.includes(sortByParam)
      ? sortByParam
      : DEFAULT_SEARCH_FILTERS.sortBy

  // Pagination - support both 'page' and legacy 'offset'
  const pageParam = params.get("page")
  const offsetParam = params.get("offset")
  const limitParam = params.get("limit")

  let page = parseInt(pageParam || "1", 10)
  const limit = Math.min(
    parseInt(limitParam || String(DEFAULT_SEARCH_FILTERS.limit), 10),
    MAX_SEARCH_LIMIT
  )

  // Convert legacy offset to page
  if (!pageParam && offsetParam) {
    const offset = parseInt(offsetParam, 10)
    page = Math.floor(offset / limit) + 1
  }

  // Validate page number
  if (isNaN(page) || page < 1) {
    page = 1
  }

  return {
    query,
    type,
    dateFrom,
    dateTo,
    isAI,
    personality,
    tagIds: tagIds && tagIds.length > 0 ? tagIds : undefined,
    hasAttachments,
    archived,
    sortBy,
    page,
    limit: isNaN(limit) ? DEFAULT_SEARCH_FILTERS.limit : limit,
  }
}

/**
 * GET /api/search/suggestions
 *
 * Returns search suggestions for auto-complete functionality.
 *
 * Query Parameters:
 * - query: Search term (required, min 2 characters)
 * - limit: Maximum number of suggestions (default: 5, max: 10)
 */
export async function POST(request: NextRequest): Promise<NextResponse<SearchSuggestionsResponse>> {
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
    return NextResponse.json({ success: false, error: "Invalid CSRF token" }, { status: 403 })
  }

  // Rate limiting
  const identifier = getClientIdentifier(request)
  if (!apiLimiter.check(identifier)) {
    return NextResponse.json(
      {
        success: false,
        error: "Too many requests. Please try again later.",
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
    // Authentication
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized. Please log in.",
        },
        { status: 401 }
      )
    }

    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    })
    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found.",
        },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { query, limit = 5 } = body as { query?: string; limit?: number }

    if (!query || query.length < MIN_QUERY_LENGTH) {
      return NextResponse.json({
        success: true,
        suggestions: [],
      })
    }

    const suggestions = await getSearchSuggestions(currentUser.id, query, Math.min(limit, 10))

    return NextResponse.json({
      success: true,
      suggestions,
    })
  } catch (error) {
    console.error("[SEARCH_SUGGESTIONS_ERROR]", error)
    return NextResponse.json(
      {
        success: false,
        error: "An error occurred. Please try again.",
      },
      { status: 500 }
    )
  }
}
