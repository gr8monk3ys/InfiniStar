import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import {
  calculateSessionExpiry,
  generateSessionToken,
  getIpFromHeaders,
  maskIpAddress,
  parseUserAgent,
} from "@/app/lib/session-utils"
import getCurrentUser from "@/app/actions/getCurrentUser"
import type { UserSessionInfo } from "@/app/types"

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

// Session registration schema (called after login)
const _registerSessionSchema = z.object({
  sessionToken: z.string().min(1, "Session token is required"),
})

/**
 * GET /api/sessions - List all active sessions for current user
 *
 * Returns all non-revoked, non-expired sessions with device/browser info.
 * The IP addresses are masked for security.
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get current session token from header (set by client after login)
    const currentSessionToken = request.headers.get("X-Session-Token")

    // Fetch all active sessions for user
    const sessions = await prisma.userSession.findMany({
      where: {
        userId: currentUser.id,
        isRevoked: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        lastActiveAt: "desc",
      },
      select: {
        id: true,
        sessionToken: true,
        deviceType: true,
        browser: true,
        os: true,
        ipAddress: true,
        createdAt: true,
        lastActiveAt: true,
      },
    })

    // Transform sessions for response (mask IP addresses)
    const sessionList: UserSessionInfo[] = sessions.map((session: { id: string; deviceType: string | null; browser: string | null; os: string | null; ipAddress: string; createdAt: Date; lastActiveAt: Date; sessionToken: string }) => ({
      id: session.id,
      deviceType: session.deviceType,
      browser: session.browser,
      os: session.os,
      ipAddress: maskIpAddress(session.ipAddress),
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
      isCurrentSession: currentSessionToken === session.sessionToken,
    }))

    return NextResponse.json({
      sessions: sessionList,
      currentSessionToken,
    })
  } catch (error: unknown) {
    console.error("SESSIONS_GET_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/sessions - Register a new session after login
 *
 * Called by the client immediately after successful authentication.
 * Creates a UserSession record with device and browser information.
 */
export async function POST(request: NextRequest) {
  try {
    // CSRF Protection
    if (!validateCsrf(request)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const currentUser = await getCurrentUser()

    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse user agent
    const userAgent = request.headers.get("user-agent")
    const deviceInfo = parseUserAgent(userAgent)

    // Get IP address
    const ipAddress = getIpFromHeaders(request.headers)

    // Generate session token
    const sessionToken = generateSessionToken()

    // Calculate expiry (30 days)
    const expiresAt = calculateSessionExpiry(30)

    // Create session record
    const session = await prisma.userSession.create({
      data: {
        sessionToken,
        userId: currentUser.id,
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        ipAddress,
        expiresAt,
      },
    })

    // Return session token for client to store
    return NextResponse.json({
      message: "Session registered successfully",
      sessionToken: session.sessionToken,
      sessionId: session.id,
    })
  } catch (error: unknown) {
    console.error("SESSION_REGISTER_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/sessions - Revoke all sessions except current
 *
 * Requires X-Session-Token header to identify current session.
 */
export async function DELETE(request: NextRequest) {
  try {
    // CSRF Protection
    if (!validateCsrf(request)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const currentUser = await getCurrentUser()

    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get current session token to preserve
    const currentSessionToken = request.headers.get("X-Session-Token")

    if (!currentSessionToken) {
      return NextResponse.json({ error: "Current session token required" }, { status: 400 })
    }

    // Revoke all other sessions
    const result = await prisma.userSession.updateMany({
      where: {
        userId: currentUser.id,
        sessionToken: {
          not: currentSessionToken,
        },
        isRevoked: false,
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    })

    return NextResponse.json({
      message: `${result.count} session(s) revoked successfully`,
      revokedCount: result.count,
    })
  } catch (error: unknown) {
    console.error("SESSIONS_REVOKE_ALL_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
