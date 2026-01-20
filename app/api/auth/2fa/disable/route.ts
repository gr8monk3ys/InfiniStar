import { NextResponse, type NextRequest } from "next/server"
import bcrypt from "bcrypt"
import { getServerSession } from "next-auth"
import { z } from "zod"

import { authOptions } from "@/app/lib/auth"
import { getCsrfTokenFromCookies, verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { getClientIdentifier, twoFactorLimiter } from "@/app/lib/rate-limit"
import {
  decryptSecret,
  parseBackupCode,
  verifyBackupCode,
  verifyTOTPCode,
} from "@/app/lib/two-factor"

const disableSchema = z.object({
  password: z.string().min(1, "Password is required"),
  code: z.string().min(1, "Verification code is required"),
})

/**
 * POST /api/auth/2fa/disable
 *
 * Disable 2FA (requires password and TOTP code or backup code)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting
    const identifier = getClientIdentifier(request)
    if (!twoFactorLimiter.check(identifier)) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      )
    }

    // CSRF validation
    const headerToken = request.headers.get("X-CSRF-Token")
    const cookieToken = await getCsrfTokenFromCookies()
    if (!verifyCsrfToken(headerToken, cookieToken)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    // Authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Validate request body
    const body = await request.json()
    const validation = disableSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0].message }, { status: 400 })
    }

    const { password, code } = validation.data

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        hashedPassword: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorBackupCodes: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (!user.twoFactorEnabled) {
      return NextResponse.json(
        { error: "Two-factor authentication is not enabled" },
        { status: 400 }
      )
    }

    if (!user.hashedPassword) {
      return NextResponse.json({ error: "Invalid account configuration" }, { status: 400 })
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.hashedPassword)
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 400 })
    }

    // Verify TOTP code or backup code
    let isCodeValid = false
    let usedBackupCodeIndex = -1

    // First try TOTP code (6 digits)
    if (code.length === 6 && /^\d+$/.test(code) && user.twoFactorSecret) {
      const secret = decryptSecret(user.twoFactorSecret)
      isCodeValid = verifyTOTPCode(code, secret)
    }

    // If TOTP failed, try backup code
    if (!isCodeValid && user.twoFactorBackupCodes.length > 0) {
      const parsedCode = parseBackupCode(code)
      usedBackupCodeIndex = verifyBackupCode(parsedCode, user.twoFactorBackupCodes)
      isCodeValid = usedBackupCodeIndex !== -1
    }

    if (!isCodeValid) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 400 })
    }

    // Disable 2FA
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
      },
    })

    return NextResponse.json({
      message: "Two-factor authentication has been disabled",
    })
  } catch (error) {
    console.error("2FA disable error:", error)
    return NextResponse.json(
      { error: "Failed to disable two-factor authentication" },
      { status: 500 }
    )
  }
}
