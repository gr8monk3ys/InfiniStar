import { cookies, headers } from "next/headers"
import { type NextResponse } from "next/server"
import bcrypt from "bcryptjs"

import {
  FALLBACK_AUTH_CLERK_ID_PREFIX,
  FALLBACK_AUTH_COOKIE_NAME,
  FALLBACK_AUTH_SESSION_DAYS,
} from "@/app/lib/auth-constants"
import prisma from "@/app/lib/prismadb"
import {
  calculateSessionExpiry,
  generateSessionToken,
  getIpFromHeaders,
  parseUserAgent,
} from "@/app/lib/session-utils"

const FALLBACK_AUTH_LAST_ACTIVE_UPDATE_MS = 5 * 60 * 1000

export function isFallbackAuthEnabled() {
  const value = process.env.ENABLE_FALLBACK_AUTH?.trim().toLowerCase()
  return value === "1" || value === "true" || value === "yes" || value === "on"
}

export function isFallbackClerkId(clerkId?: string | null) {
  return Boolean(clerkId?.startsWith(FALLBACK_AUTH_CLERK_ID_PREFIX))
}

export function createFallbackClerkId() {
  return `${FALLBACK_AUTH_CLERK_ID_PREFIX}${crypto.randomUUID()}`
}

export async function hashFallbackPassword(password: string) {
  return bcrypt.hash(password, 12)
}

export async function verifyFallbackPassword(password: string, hashedPassword: string) {
  return bcrypt.compare(password, hashedPassword)
}

export async function getFallbackSessionTokenFromCookies() {
  const cookieStore = await cookies()
  return cookieStore.get(FALLBACK_AUTH_COOKIE_NAME)?.value ?? null
}

export async function getFallbackSessionByToken(sessionToken: string) {
  const now = new Date()

  const session = await prisma.userSession.findFirst({
    where: {
      sessionToken,
      isRevoked: false,
      expiresAt: {
        gt: now,
      },
    },
    include: {
      user: true,
    },
  })

  if (!session) {
    return null
  }

  if (now.getTime() - session.lastActiveAt.getTime() > FALLBACK_AUTH_LAST_ACTIVE_UPDATE_MS) {
    void prisma.userSession
      .update({
        where: { id: session.id },
        data: { lastActiveAt: now },
      })
      .catch(() => {
        // Best-effort session telemetry only.
      })
  }

  return session
}

export async function createFallbackSession(userId: string) {
  const headersList = await headers()
  const userAgent = headersList.get("user-agent")
  const ipAddress = getIpFromHeaders(new Headers(headersList))
  const deviceInfo = parseUserAgent(userAgent)
  const sessionToken = generateSessionToken()
  const expiresAt = calculateSessionExpiry(FALLBACK_AUTH_SESSION_DAYS)

  const session = await prisma.userSession.create({
    data: {
      sessionToken,
      userId,
      deviceType: deviceInfo.deviceType,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      ipAddress,
      expiresAt,
    },
  })

  return {
    expiresAt,
    session,
    sessionToken,
  }
}

export function applyFallbackSessionCookie(
  response: NextResponse,
  sessionToken: string,
  expiresAt: Date
) {
  response.cookies.set(FALLBACK_AUTH_COOKIE_NAME, sessionToken, {
    expires: expiresAt,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
}

export function clearFallbackSessionCookie(response: NextResponse) {
  response.cookies.set(FALLBACK_AUTH_COOKIE_NAME, "", {
    expires: new Date(0),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
}

export async function revokeFallbackSessionByToken(sessionToken: string | null) {
  if (!sessionToken) {
    return
  }

  await prisma.userSession.updateMany({
    where: {
      sessionToken,
      isRevoked: false,
    },
    data: {
      isRevoked: true,
      revokedAt: new Date(),
    },
  })
}

export async function findFallbackUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
    },
    select: {
      id: true,
      clerkId: true,
      name: true,
      email: true,
      image: true,
      hashedPassword: true,
    },
  })
}
