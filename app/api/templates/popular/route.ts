import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { apiLogger } from "@/app/lib/logger"
import { getPopularTemplates, getRecentlyUsedTemplates } from "@/app/lib/templates"
import getCurrentUser from "@/app/actions/getCurrentUser"

// Query params schema
const queryParamsSchema = z.object({
  limit: z.coerce.number().int().positive().max(20).optional().default(5),
  type: z.enum(["popular", "recent"]).optional().default("popular"),
})

/**
 * GET /api/templates/popular?limit=5&type=popular
 * Get popular or recently used templates for quick access
 *
 * Query params:
 * - limit: Maximum number of templates to return (default: 5, max: 20)
 * - type: 'popular' for most used, 'recent' for recently used (default: popular)
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const params = Object.fromEntries(searchParams.entries())

    const validationResult = queryParamsSchema.safeParse(params)
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.issues[0].message }, { status: 400 })
    }

    const { limit, type } = validationResult.data

    let templates
    if (type === "recent") {
      templates = await getRecentlyUsedTemplates(currentUser.id, limit)
    } else {
      templates = await getPopularTemplates(currentUser.id, limit)
    }

    return NextResponse.json({
      templates,
      total: templates.length,
      type,
    })
  } catch (error) {
    apiLogger.error({ err: error }, "Error fetching popular templates")
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 })
  }
}
