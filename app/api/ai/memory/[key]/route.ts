import { NextResponse, type NextRequest } from "next/server"
import { MemoryCategory } from "@prisma/client"
import { z } from "zod"

import {
  deleteMemory,
  getMemoryByKey,
  MAX_MEMORY_CONTENT_LENGTH,
  saveMemory,
} from "@/app/lib/ai-memory"
import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { getClientIdentifier, memoryLimiter } from "@/app/lib/rate-limit"
import { sanitizePlainText } from "@/app/lib/sanitize"
import getCurrentUser from "@/app/actions/getCurrentUser"

// Validation schema for updating a memory (key cannot be changed)
const updateMemorySchema = z.object({
  content: z
    .string()
    .min(1, "Memory content is required")
    .max(
      MAX_MEMORY_CONTENT_LENGTH,
      `Memory content must be ${MAX_MEMORY_CONTENT_LENGTH} characters or less`
    ),
  category: z.nativeEnum(MemoryCategory).optional(),
  importance: z.number().int().min(1).max(5).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
})

interface RouteParams {
  params: Promise<{
    key: string
  }>
}

/**
 * GET /api/ai/memory/[key]
 * Get a specific memory by key
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }

    const { key } = await params

    if (!key) {
      return NextResponse.json({ error: "Memory key is required" }, { status: 400 })
    }

    const memory = await getMemoryByKey(currentUser.id, key)

    if (!memory) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 })
    }

    return NextResponse.json({ memory })
  } catch (error) {
    console.error("Error fetching memory:", error)
    return NextResponse.json({ error: "Failed to fetch memory" }, { status: 500 })
  }
}

/**
 * DELETE /api/ai/memory/[key]
 * Delete a specific memory by key
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limiting
    const identifier = getClientIdentifier(request)
    const allowed = await Promise.resolve(memoryLimiter.check(identifier))
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      )
    }

    // CSRF Protection
    const headerToken = request.headers.get("X-CSRF-Token")
    const cookieToken = getCsrfTokenFromRequest(request)

    if (!verifyCsrfToken(headerToken, cookieToken)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }

    const { key } = await params

    if (!key) {
      return NextResponse.json({ error: "Memory key is required" }, { status: 400 })
    }

    // Check if memory exists
    const existingMemory = await getMemoryByKey(currentUser.id, key)
    if (!existingMemory) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 })
    }

    // Delete the memory
    const deleted = await deleteMemory(currentUser.id, key)

    if (!deleted) {
      return NextResponse.json({ error: "Failed to delete memory" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Memory deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting memory:", error)
    return NextResponse.json({ error: "Failed to delete memory" }, { status: 500 })
  }
}

/**
 * PATCH /api/ai/memory/[key]
 * Update an existing memory by key (content, category, importance)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limiting
    const identifier = getClientIdentifier(request)
    const allowed = await Promise.resolve(memoryLimiter.check(identifier))
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      )
    }

    // CSRF Protection
    const headerToken = request.headers.get("X-CSRF-Token")
    const cookieToken = getCsrfTokenFromRequest(request)

    if (!verifyCsrfToken(headerToken, cookieToken)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }

    const { key } = await params

    if (!key) {
      return NextResponse.json({ error: "Memory key is required" }, { status: 400 })
    }

    // Check memory exists
    const existingMemory = await getMemoryByKey(currentUser.id, key)
    if (!existingMemory) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 })
    }

    const body = await request.json()

    // Validate input
    const validationResult = updateMemorySchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.issues[0].message }, { status: 400 })
    }

    const { content, category, importance, expiresAt } = validationResult.data

    // Sanitize content
    const sanitizedContent = sanitizePlainText(content)
    if (!sanitizedContent) {
      return NextResponse.json({ error: "Invalid memory content" }, { status: 400 })
    }

    // Update memory — reuse saveMemory which upserts
    const memory = await saveMemory(currentUser.id, key, sanitizedContent, {
      category: category ?? existingMemory.category,
      importance: importance ?? existingMemory.importance,
      expiresAt:
        expiresAt !== undefined
          ? expiresAt
            ? new Date(expiresAt)
            : null
          : existingMemory.expiresAt,
    })

    return NextResponse.json({
      memory,
      isUpdate: true,
      message: "Memory updated successfully",
    })
  } catch (error) {
    console.error("Error updating memory:", error)
    return NextResponse.json({ error: "Failed to update memory" }, { status: 500 })
  }
}
