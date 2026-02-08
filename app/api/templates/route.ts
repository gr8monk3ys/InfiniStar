import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { z } from "zod"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { getClientIdentifier, templateLimiter } from "@/app/lib/rate-limit"
import { sanitizePlainText } from "@/app/lib/sanitize"
import {
  createTemplate,
  getTemplateLimitInfo,
  getUserTemplateCategories,
  getUserTemplates,
  validateTemplateData,
} from "@/app/lib/templates"
import { TEMPLATE_CATEGORIES, TEMPLATE_CONSTRAINTS, TEMPLATE_SHORTCUT_PATTERN } from "@/app/types"

// Validation schema for creating a template
const createTemplateSchema = z.object({
  name: z
    .string()
    .min(TEMPLATE_CONSTRAINTS.NAME_MIN_LENGTH, "Template name is required")
    .max(
      TEMPLATE_CONSTRAINTS.NAME_MAX_LENGTH,
      `Template name must be ${TEMPLATE_CONSTRAINTS.NAME_MAX_LENGTH} characters or less`
    )
    .trim(),
  content: z
    .string()
    .min(TEMPLATE_CONSTRAINTS.CONTENT_MIN_LENGTH, "Template content is required")
    .max(
      TEMPLATE_CONSTRAINTS.CONTENT_MAX_LENGTH,
      `Template content must be ${TEMPLATE_CONSTRAINTS.CONTENT_MAX_LENGTH} characters or less`
    ),
  shortcut: z
    .string()
    .min(TEMPLATE_CONSTRAINTS.SHORTCUT_MIN_LENGTH)
    .max(TEMPLATE_CONSTRAINTS.SHORTCUT_MAX_LENGTH)
    .regex(TEMPLATE_SHORTCUT_PATTERN, {
      message:
        'Shortcut must start with "/" and contain only letters, numbers, hyphens, and underscores',
    })
    .optional()
    .nullable()
    .transform((val) => val || null),
  category: z
    .string()
    .max(TEMPLATE_CONSTRAINTS.CATEGORY_MAX_LENGTH)
    .optional()
    .nullable()
    .transform((val) => val || null),
})

// Query params schema for GET
const queryParamsSchema = z.object({
  category: z.string().optional(),
  sortBy: z.enum(["name", "createdAt", "updatedAt", "usageCount"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  limit: z.coerce.number().int().positive().optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
  search: z.string().optional(),
})

/**
 * GET /api/templates
 * Get all templates for the current user with optional filtering
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

    const { category, sortBy, sortOrder, limit, offset, search } = validationResult.data

    const [templates, limitInfo, categories] = await Promise.all([
      getUserTemplates(currentUser.id, {
        category,
        sortBy,
        sortOrder,
        limit,
        offset,
        search,
      }),
      getTemplateLimitInfo(currentUser.id),
      getUserTemplateCategories(currentUser.id),
    ])

    return NextResponse.json({
      templates,
      total: templates.length,
      limitInfo,
      categories,
      predefinedCategories: TEMPLATE_CATEGORIES,
    })
  } catch (error) {
    console.error("Error fetching templates:", error)
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 })
  }
}

/**
 * POST /api/templates
 * Create a new template for the current user
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = getClientIdentifier(request)
    if (!templateLimiter.check(identifier)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      )
    }

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
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

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

    const body = await request.json()

    // Validate input
    const validationResult = createTemplateSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.issues[0].message }, { status: 400 })
    }

    const { name, content, shortcut, category } = validationResult.data

    // Sanitize inputs
    const sanitizedName = sanitizePlainText(name)
    const sanitizedContent = sanitizePlainText(content)
    const sanitizedCategory = category ? sanitizePlainText(category) : null

    if (!sanitizedName || !sanitizedContent) {
      return NextResponse.json({ error: "Invalid template data" }, { status: 400 })
    }

    // Additional validation
    const validation = validateTemplateData({
      name: sanitizedName,
      content: sanitizedContent,
      shortcut,
      category: sanitizedCategory,
    })

    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Create template
    const template = await createTemplate(currentUser.id, {
      name: sanitizedName,
      content: sanitizedContent,
      shortcut,
      category: sanitizedCategory,
    })

    // Get updated limit info
    const limitInfo = await getTemplateLimitInfo(currentUser.id)

    return NextResponse.json({
      template,
      limitInfo,
    })
  } catch (error) {
    console.error("Error creating template:", error)

    // Handle specific errors
    if (error instanceof Error) {
      if (
        error.message.includes("Template limit reached") ||
        error.message.includes("already exists") ||
        error.message.includes("already in use")
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    return NextResponse.json({ error: "Failed to create template" }, { status: 500 })
  }
}
