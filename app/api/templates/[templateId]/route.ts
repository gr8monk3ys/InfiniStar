import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { z } from "zod"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { getClientIdentifier, templateLimiter } from "@/app/lib/rate-limit"
import { sanitizePlainText } from "@/app/lib/sanitize"
import {
  deleteTemplate,
  getTemplateById,
  getTemplateLimitInfo,
  updateTemplate,
  validateTemplateData,
} from "@/app/lib/templates"
import { TEMPLATE_CONSTRAINTS, TEMPLATE_SHORTCUT_PATTERN } from "@/app/types"

// Validation schema for updating a template
const updateTemplateSchema = z.object({
  name: z
    .string()
    .min(TEMPLATE_CONSTRAINTS.NAME_MIN_LENGTH, "Template name is required")
    .max(
      TEMPLATE_CONSTRAINTS.NAME_MAX_LENGTH,
      `Template name must be ${TEMPLATE_CONSTRAINTS.NAME_MAX_LENGTH} characters or less`
    )
    .trim()
    .optional(),
  content: z
    .string()
    .min(TEMPLATE_CONSTRAINTS.CONTENT_MIN_LENGTH, "Template content is required")
    .max(
      TEMPLATE_CONSTRAINTS.CONTENT_MAX_LENGTH,
      `Template content must be ${TEMPLATE_CONSTRAINTS.CONTENT_MAX_LENGTH} characters or less`
    )
    .optional(),
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
    .transform((val) => (val === "" ? null : val)),
  category: z
    .string()
    .max(TEMPLATE_CONSTRAINTS.CATEGORY_MAX_LENGTH)
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
})

interface RouteParams {
  params: Promise<{ templateId: string }>
}

/**
 * GET /api/templates/[templateId]
 * Get a specific template
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const { templateId } = await params

    if (!templateId) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 })
    }

    const template = await getTemplateById(templateId, currentUser.id)

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error("Error fetching template:", error)
    return NextResponse.json({ error: "Failed to fetch template" }, { status: 500 })
  }
}

/**
 * PATCH /api/templates/[templateId]
 * Update a template
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limiting
    const identifier = getClientIdentifier(request)
    const allowed = await Promise.resolve(templateLimiter.check(identifier))
    if (!allowed) {
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

    const { templateId } = await params

    if (!templateId) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 })
    }

    const body = await request.json()

    // Validate input
    const validationResult = updateTemplateSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.issues[0].message }, { status: 400 })
    }

    const { name, content, shortcut, category } = validationResult.data

    // Sanitize inputs
    const sanitizedName = name ? sanitizePlainText(name) : undefined
    const sanitizedContent = content ? sanitizePlainText(content) : undefined
    const sanitizedCategory = category ? sanitizePlainText(category) : category

    // Additional validation
    const dataToValidate: Record<string, string | null | undefined> = {}
    if (sanitizedName !== undefined) dataToValidate.name = sanitizedName
    if (sanitizedContent !== undefined) dataToValidate.content = sanitizedContent
    if (shortcut !== undefined) dataToValidate.shortcut = shortcut
    if (sanitizedCategory !== undefined) dataToValidate.category = sanitizedCategory

    const validation = validateTemplateData(dataToValidate)
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Update template
    const template = await updateTemplate(templateId, currentUser.id, {
      ...(sanitizedName !== undefined && { name: sanitizedName }),
      ...(sanitizedContent !== undefined && { content: sanitizedContent }),
      ...(shortcut !== undefined && { shortcut }),
      ...(sanitizedCategory !== undefined && { category: sanitizedCategory }),
    })

    return NextResponse.json({ template })
  } catch (error) {
    console.error("Error updating template:", error)

    // Handle specific errors
    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("already exists") ||
        error.message.includes("already in use") ||
        error.message.includes("Invalid shortcut")
      ) {
        const status = error.message.includes("not found") ? 404 : 400
        return NextResponse.json({ error: error.message }, { status })
      }
    }

    return NextResponse.json({ error: "Failed to update template" }, { status: 500 })
  }
}

/**
 * DELETE /api/templates/[templateId]
 * Delete a template
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limiting
    const identifier = getClientIdentifier(request)
    const allowed = await Promise.resolve(templateLimiter.check(identifier))
    if (!allowed) {
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

    const { templateId } = await params

    if (!templateId) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 })
    }

    await deleteTemplate(templateId, currentUser.id)

    // Get updated limit info
    const limitInfo = await getTemplateLimitInfo(currentUser.id)

    return NextResponse.json({
      success: true,
      message: "Template deleted successfully",
      limitInfo,
    })
  } catch (error) {
    console.error("Error deleting template:", error)

    // Handle specific errors
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 })
  }
}
