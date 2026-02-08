import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { z } from "zod"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { getClientIdentifier, templateLimiter } from "@/app/lib/rate-limit"
import {
  getTemplateById,
  incrementTemplateUsage,
  processTemplateVariables,
} from "@/app/lib/templates"
import { type TemplateVariables } from "@/app/types"

// Validation schema for variables
const useTemplateSchema = z.object({
  variables: z.record(z.string(), z.string()).optional(),
})

interface RouteParams {
  params: Promise<{ templateId: string }>
}

/**
 * POST /api/templates/[templateId]/use
 * Increment usage count for a template and return processed content
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const { templateId } = await params

    if (!templateId) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 })
    }

    // Parse optional variables from request body
    let variables: TemplateVariables = {}
    try {
      const body = await request.json()
      const validationResult = useTemplateSchema.safeParse(body)
      if (validationResult.success && validationResult.data.variables) {
        variables = validationResult.data.variables
      }
    } catch {
      // Body is optional, proceed without variables
    }

    // Verify template exists and belongs to user
    const template = await getTemplateById(templateId, currentUser.id)

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    // Increment usage count
    const updatedTemplate = await incrementTemplateUsage(templateId, currentUser.id)

    // Process template content with variables
    const processedContent = processTemplateVariables(updatedTemplate.content, variables)

    return NextResponse.json({
      template: updatedTemplate,
      content: processedContent,
      rawContent: updatedTemplate.content,
    })
  } catch (error) {
    console.error("Error using template:", error)

    // Handle specific errors
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ error: "Failed to use template" }, { status: 500 })
  }
}
