import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"

import { authOptions } from "@/app/lib/auth"
import { getPopularTemplates, getRecentlyUsedTemplates } from "@/app/lib/templates"

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
    const session = await getServerSession(authOptions)
    const currentUser = session?.user

    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const params = Object.fromEntries(searchParams.entries())

    const validationResult = queryParamsSchema.safeParse(params)
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.errors[0].message }, { status: 400 })
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
    console.error("Error fetching popular templates:", error)
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 })
  }
}
