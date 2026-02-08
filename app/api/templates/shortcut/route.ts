import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { z } from "zod"

import prisma from "@/app/lib/prismadb"
import { findTemplateByShortcut, getUserTemplates } from "@/app/lib/templates"

// Query params schema
const queryParamsSchema = z.object({
  shortcut: z.string().min(1, "Shortcut is required"),
  exact: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => val === "true"),
})

/**
 * GET /api/templates/shortcut?shortcut=/thanks&exact=true
 * Find a template by its shortcut
 *
 * Query params:
 * - shortcut: The shortcut to search for (required)
 * - exact: If true, returns exact match only. If false, returns all templates starting with the shortcut (default: false)
 */
export async function GET(request: NextRequest) {
  try {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const params = Object.fromEntries(searchParams.entries())

    const validationResult = queryParamsSchema.safeParse(params)
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.issues[0].message }, { status: 400 })
    }

    const { shortcut, exact = false } = validationResult.data

    // Normalize shortcut
    const normalizedShortcut = shortcut.startsWith("/") ? shortcut : `/${shortcut}`

    if (exact) {
      // Return exact match only
      const template = await findTemplateByShortcut(currentUser.id, normalizedShortcut)

      if (!template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 })
      }

      return NextResponse.json({ template })
    } else {
      // Return all templates that start with the shortcut (for autocomplete)
      const allTemplates = await getUserTemplates(currentUser.id, {
        sortBy: "usageCount",
        sortOrder: "desc",
      })

      // Filter templates that have shortcuts starting with the query
      const matchingTemplates = allTemplates.filter(
        (template) =>
          template.shortcut &&
          template.shortcut.toLowerCase().startsWith(normalizedShortcut.toLowerCase())
      )

      return NextResponse.json({
        templates: matchingTemplates,
        total: matchingTemplates.length,
      })
    }
  } catch (error) {
    console.error("Error finding template by shortcut:", error)
    return NextResponse.json({ error: "Failed to find template" }, { status: 500 })
  }
}
