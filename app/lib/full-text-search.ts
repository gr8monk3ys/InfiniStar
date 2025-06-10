import prisma from "@/app/lib/prismadb"

/**
 * Convert a user search query into a tsquery string.
 *
 * Strategy: split on whitespace, stem each word via plainto_tsquery,
 * append :* to the last word for prefix matching (autocomplete UX).
 * Words are joined with & (AND) so all terms must match.
 *
 * Examples:
 *   "hello world"  → 'hello & world:*'
 *   "react hooks"  → 'react & hooks:*'
 *   "a"            → 'a:*'
 */
function buildTsquery(query: string): string {
  const words = query
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
  if (words.length === 0) return ""

  // Sanitize: remove characters that are tsquery operators
  const sanitize = (w: string): string => w.replace(/[&|!<>():*'"\\]/g, "")

  const parts = words.map(sanitize).filter((w) => w.length > 0)
  if (parts.length === 0) return ""

  // All words joined with AND, last word gets prefix matching
  const last = parts.length - 1
  return parts.map((w, i) => (i === last ? `${w}:*` : w)).join(" & ")
}

/**
 * Find message IDs matching a full-text search query.
 * Returns IDs sorted by relevance (ts_rank).
 */
export async function searchMessageIdsByText(
  query: string,
  limit: number = 500
): Promise<string[]> {
  const tsquery = buildTsquery(query)
  if (!tsquery) return []

  const results = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM messages
    WHERE search_vector @@ to_tsquery('english', ${tsquery})
      AND is_deleted = false
    ORDER BY ts_rank(search_vector, to_tsquery('english', ${tsquery})) DESC
    LIMIT ${limit}
  `

  return results.map((r) => r.id)
}

/**
 * Find conversation IDs where the name matches the full-text query.
 */
export async function searchConversationIdsByName(
  query: string,
  limit: number = 500
): Promise<string[]> {
  const tsquery = buildTsquery(query)
  if (!tsquery) return []

  const results = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM conversations
    WHERE name_search_vector @@ to_tsquery('english', ${tsquery})
    ORDER BY ts_rank(name_search_vector, to_tsquery('english', ${tsquery})) DESC
    LIMIT ${limit}
  `

  return results.map((r) => r.id)
}

/**
 * Find conversation IDs where the name matches OR any message body matches.
 * This is the main entry point for conversation search.
 */
export async function searchConversationIdsByText(
  query: string,
  userId: string,
  limit: number = 500
): Promise<string[]> {
  const tsquery = buildTsquery(query)
  if (!tsquery) return []

  const results = await prisma.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT c.id FROM conversations c
    JOIN "_UserConversations" uc ON uc."A" = c.id
    WHERE uc."B" = ${userId}::uuid
      AND (
        c.name_search_vector @@ to_tsquery('english', ${tsquery})
        OR EXISTS (
          SELECT 1 FROM messages m
          WHERE m.conversation_id = c.id
            AND m.is_deleted = false
            AND m.search_vector @@ to_tsquery('english', ${tsquery})
        )
      )
    LIMIT ${limit}
  `

  return results.map((r) => r.id)
}

export { buildTsquery }
