import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"

import { deleteMemory, getMemoryByKey } from "@/app/lib/ai-memory"
import { authOptions } from "@/app/lib/auth"
import { verifyCsrfToken } from "@/app/lib/csrf"
import { getClientIdentifier, memoryLimiter } from "@/app/lib/rate-limit"

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
    const session = await getServerSession(authOptions)
    const currentUser = session?.user

    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
      const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
        const [keyName, value] = cookie.trim().split("=")
        acc[keyName] = value
        return acc
      }, {} as Record<string, string>)
      cookieToken = cookies["csrf-token"] || null
    }

    if (!verifyCsrfToken(headerToken, cookieToken)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const session = await getServerSession(authOptions)
    const currentUser = session?.user

    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
