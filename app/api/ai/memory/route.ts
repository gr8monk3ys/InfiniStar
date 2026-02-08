import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { MemoryCategory } from "@prisma/client"
import { z } from "zod"

import {
  canCreateMemory,
  getMemoryByKey,
  getUserMemories,
  MAX_MEMORY_CONTENT_LENGTH,
  MEMORY_CATEGORIES,
  saveMemory,
} from "@/app/lib/ai-memory"
import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { getClientIdentifier, memoryLimiter } from "@/app/lib/rate-limit"
import { sanitizePlainText } from "@/app/lib/sanitize"

// Validation schema for creating/updating a memory
const createMemorySchema = z.object({
  key: z
    .string()
    .min(1, "Memory key is required")
    .max(100, "Memory key must be 100 characters or less")
    .regex(/^[a-z0-9_]+$/, "Key must be lowercase alphanumeric with underscores only"),
  content: z
    .string()
    .min(1, "Memory content is required")
    .max(
      MAX_MEMORY_CONTENT_LENGTH,
      `Memory content must be ${MAX_MEMORY_CONTENT_LENGTH} characters or less`
    ),
  category: z.nativeEnum(MemoryCategory).optional().default(MemoryCategory.FACT),
  importance: z.number().int().min(1).max(5).optional().default(3),
  expiresAt: z.string().datetime().nullable().optional(),
})

// Validation schema for listing memories
const listMemoriesSchema = z.object({
  category: z.nativeEnum(MemoryCategory).optional(),
  includeExpired: z.coerce.boolean().optional().default(false),
})

/**
 * GET /api/ai/memory
 * List all memories for the current user
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
    const queryResult = listMemoriesSchema.safeParse({
      category: searchParams.get("category") || undefined,
      includeExpired: searchParams.get("includeExpired") || false,
    })

    if (!queryResult.success) {
      return NextResponse.json({ error: queryResult.error.issues[0].message }, { status: 400 })
    }

    const { category, includeExpired } = queryResult.data

    // Get memories
    const memories = await getUserMemories(currentUser.id, {
      category,
      includeExpired,
      orderBy: "importance",
      order: "desc",
    })

    // Get capacity info
    const capacityInfo = await canCreateMemory(currentUser.id)

    return NextResponse.json({
      memories,
      categories: MEMORY_CATEGORIES,
      capacity: {
        current: capacityInfo.current,
        limit: capacityInfo.limit,
        remaining: capacityInfo.limit - capacityInfo.current,
      },
    })
  } catch (error) {
    console.error("Error fetching memories:", error)
    return NextResponse.json({ error: "Failed to fetch memories" }, { status: 500 })
  }
}

/**
 * POST /api/ai/memory
 * Create or update a memory
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = getClientIdentifier(request)
    if (!memoryLimiter.check(identifier)) {
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
    const validationResult = createMemorySchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.issues[0].message }, { status: 400 })
    }

    const { key, content, category, importance, expiresAt } = validationResult.data

    // Sanitize content
    const sanitizedContent = sanitizePlainText(content)
    if (!sanitizedContent) {
      return NextResponse.json({ error: "Invalid memory content" }, { status: 400 })
    }

    // Check if this is an update or create
    const existingMemory = await getMemoryByKey(currentUser.id, key)
    const isUpdate = !!existingMemory

    // If creating new, check capacity
    if (!isUpdate) {
      const capacityInfo = await canCreateMemory(currentUser.id)
      if (!capacityInfo.allowed) {
        return NextResponse.json(
          {
            error: `Memory limit reached (${capacityInfo.current}/${capacityInfo.limit}). Delete some memories or upgrade to PRO.`,
          },
          { status: 400 }
        )
      }
    }

    // Save the memory
    const memory = await saveMemory(currentUser.id, key, sanitizedContent, {
      category,
      importance,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    })

    return NextResponse.json({
      memory,
      isUpdate,
      message: isUpdate ? "Memory updated successfully" : "Memory created successfully",
    })
  } catch (error) {
    console.error("Error saving memory:", error)
    const message = error instanceof Error ? error.message : "Failed to save memory"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
