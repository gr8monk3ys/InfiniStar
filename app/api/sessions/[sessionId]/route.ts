import { NextResponse, type NextRequest } from "next/server"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import getCurrentUser from "@/app/actions/getCurrentUser"

// Helper function to validate CSRF token
function validateCsrf(request: NextRequest): boolean {
  const headerToken = request.headers.get("X-CSRF-Token")
  const cookieHeader = request.headers.get("cookie")
  let cookieToken: string | null = null

  if (cookieHeader) {
    const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split("=")
      acc[key] = value
      return acc
    }, {} as Record<string, string>)
    cookieToken = cookies["csrf-token"] || null
  }

  return verifyCsrfToken(headerToken, cookieToken)
}

interface RouteParams {
  params: Promise<{
    sessionId: string
  }>
}

/**
 * DELETE /api/sessions/[sessionId] - Revoke a specific session
 *
 * Security checks:
 * - User must be authenticated
 * - Session must belong to the authenticated user
 * - CSRF token must be valid
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // CSRF Protection
    if (!validateCsrf(request)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const currentUser = await getCurrentUser()

    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { sessionId } = await params

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 })
    }

    // Find the session and verify ownership
    const session = await prisma.userSession.findUnique({
      where: {
        id: sessionId,
      },
      select: {
        id: true,
        userId: true,
        sessionToken: true,
        isRevoked: true,
      },
    })

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Security check: ensure session belongs to current user
    if (session.userId !== currentUser.id) {
      // Return 404 to avoid leaking information about session existence
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    if (session.isRevoked) {
      return NextResponse.json({ error: "Session already revoked" }, { status: 400 })
    }

    // Get current session token to check if trying to revoke current session
    const currentSessionToken = request.headers.get("X-Session-Token")
    const isCurrentSession = currentSessionToken === session.sessionToken

    // Revoke the session
    await prisma.userSession.update({
      where: {
        id: sessionId,
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    })

    return NextResponse.json({
      message: "Session revoked successfully",
      isCurrentSession,
    })
  } catch (error: unknown) {
    console.error("SESSION_REVOKE_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/sessions/[sessionId] - Update session last active time
 *
 * Called periodically to keep session activity updated.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { sessionId } = await params

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 })
    }

    // Find and update session (only if owned by current user)
    const session = await prisma.userSession.findUnique({
      where: {
        id: sessionId,
      },
      select: {
        userId: true,
        isRevoked: true,
      },
    })

    if (!session || session.userId !== currentUser.id) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    if (session.isRevoked) {
      return NextResponse.json({ error: "Session has been revoked" }, { status: 403 })
    }

    // Update last active time
    await prisma.userSession.update({
      where: {
        id: sessionId,
      },
      data: {
        lastActiveAt: new Date(),
      },
    })

    return NextResponse.json({
      message: "Session updated successfully",
    })
  } catch (error: unknown) {
    console.error("SESSION_UPDATE_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
