import type { User } from "@prisma/client"

/**
 * Search Types
 *
 * Types for the advanced global search feature that searches across
 * conversations and messages with filtering and faceted search.
 */

/**
 * Sort options for search results
 */
export type SearchSortBy = "relevance" | "date" | "messageCount"

/**
 * Search result type filter
 */
export type SearchResultType = "all" | "conversations" | "messages"

/**
 * AI personality options for filtering
 */
export type AIPersonality =
  | "helpful"
  | "concise"
  | "creative"
  | "analytical"
  | "empathetic"
  | "professional"
  | "custom"

/**
 * Extended filters for advanced search
 */
export interface AdvancedSearchFilters {
  /** Search term */
  query: string
  /** Filter by result type */
  type: SearchResultType
  /** Filter by start date (ISO string) */
  dateFrom?: string
  /** Filter by end date (ISO string) */
  dateTo?: string
  /** Filter AI conversations (true = AI only, false = human only, undefined = all) */
  isAI?: boolean
  /** Filter by AI personality */
  personality?: AIPersonality
  /** Filter by tag IDs */
  tagIds?: string[]
  /** Filter messages with attachments/images */
  hasAttachments?: boolean
  /** Include archived conversations */
  archived?: boolean
  /** Sort results by */
  sortBy: SearchSortBy
  /** Page number (1-indexed) */
  page: number
  /** Results per page */
  limit: number
}

/**
 * Search filters from query parameters (legacy compatibility)
 */
export interface SearchFilters {
  /** Search term */
  q: string
  /** Filter by start date (ISO string) */
  dateFrom?: string
  /** Filter by end date (ISO string) */
  dateTo?: string
  /** Filter by conversation type: 'ai', 'human', or 'all' */
  conversationType?: "ai" | "human" | "all"
  /** Pagination offset */
  offset?: number
  /** Number of results to return (default 20, max 50) */
  limit?: number
}

/**
 * Search result for a conversation match
 */
export interface ConversationSearchResult {
  id: string
  name: string | null
  isAI: boolean
  isGroup: boolean
  aiPersonality?: string | null
  createdAt: string
  lastMessageAt: string
  /** Users in the conversation (excluding current user) */
  users: Pick<User, "id" | "name" | "email" | "image">[]
  /** Number of messages in conversation */
  messageCount: number
  /** Tags associated with the conversation */
  tags?: Array<{ id: string; name: string; color: string }>
  /** Highlighted snippet of matching content */
  snippet?: string
  /** Whether the conversation is archived by current user */
  isArchived?: boolean
  /** Relevance score (higher = more relevant) */
  relevanceScore?: number
}

/**
 * Search result for a message match
 */
export interface MessageSearchResult {
  id: string
  body: string
  /** Highlighted body with search term marked */
  highlightedBody: string
  createdAt: string
  isAI: boolean
  /** Whether message has an image attachment */
  hasImage: boolean
  sender: Pick<User, "id" | "name" | "email" | "image">
  conversation: {
    id: string
    name: string | null
    isAI: boolean
    isGroup: boolean
  }
  /** Context: messages before and after */
  context?: {
    before?: string
    after?: string
  }
  /** Relevance score (higher = more relevant) */
  relevanceScore?: number
}

/**
 * Grouped search results
 */
export interface SearchResults {
  /** Total number of conversation matches */
  conversationCount: number
  /** Total number of message matches */
  messageCount: number
  /** Matching conversations */
  conversations: ConversationSearchResult[]
  /** Matching messages */
  messages: MessageSearchResult[]
  /** Current page (1-indexed) */
  page: number
  /** Results limit per request */
  limit: number
  /** Total pages available */
  totalPages: number
  /** Whether there are more results */
  hasMore: boolean
  /** Search execution time in ms */
  searchTimeMs?: number
}

/**
 * Search API response
 */
export interface SearchResponse {
  success: boolean
  data?: SearchResults
  error?: string
}

/**
 * Search suggestion item
 */
export interface SearchSuggestion {
  id: string
  type: "conversation" | "message" | "tag" | "recent"
  text: string
  /** Additional context for the suggestion */
  context?: string
  /** Highlighted text with query match */
  highlightedText?: string
}

/**
 * Recent search item stored in localStorage or database
 */
export interface RecentSearch {
  id: string
  query: string
  timestamp: number
  /** Filters that were applied */
  filters?: Partial<AdvancedSearchFilters>
  /** Number of results found */
  resultCount?: number
}

/**
 * Search suggestions response
 */
export interface SearchSuggestionsResponse {
  success: boolean
  suggestions?: SearchSuggestion[]
  error?: string
}

/**
 * Faceted search counts
 */
export interface SearchFacets {
  /** Count of AI vs human conversations */
  conversationType: {
    ai: number
    human: number
  }
  /** Count by AI personality */
  personality: Record<AIPersonality, number>
  /** Count by tag */
  tags: Array<{ id: string; name: string; color: string; count: number }>
  /** Count by date range */
  dateRanges: {
    today: number
    thisWeek: number
    thisMonth: number
    older: number
  }
  /** Count of messages with attachments */
  hasAttachments: number
}

/**
 * Extended search response with facets
 */
export interface AdvancedSearchResponse extends SearchResponse {
  facets?: SearchFacets
}

/**
 * Default search filters
 */
export const DEFAULT_SEARCH_FILTERS: AdvancedSearchFilters = {
  query: "",
  type: "all",
  sortBy: "relevance",
  page: 1,
  limit: 20,
  archived: false,
}

/**
 * Maximum results per page
 */
export const MAX_SEARCH_LIMIT = 50

/**
 * Minimum query length
 */
export const MIN_QUERY_LENGTH = 2

/**
 * Maximum recent searches to store
 */
export const MAX_RECENT_SEARCHES = 10

/**
 * Local storage key for recent searches
 */
export const RECENT_SEARCHES_KEY = "infinistar_recent_searches"
