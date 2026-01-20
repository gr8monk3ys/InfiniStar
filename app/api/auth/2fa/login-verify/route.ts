import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { getCsrfTokenFromCookies, verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { getClientIdentifier, twoFactorLimiter } from "@/app/lib/rate-limit"
import {
  decryptSecret,
  parseBackupCode,
  verifyBackupCode,
  verifyTOTPCode,
} from "@/app/lib/two-factor"
import { clear2FAToken, get2FAToken } from "@/app/lib/two-factor-tokens"

const verifyLoginSchema = z.object({
  email: z.string().email("Invalid email"),
  code: z.string().min(1, "Verification code is required"),
  twoFactorToken: z.string().min(1, "Two-factor token is required"),
})

/**
 * POST /api/auth/2fa/login-verify
 *
 * Verify 2FA code during login flow
 * Returns success if code is valid, allowing the login to complete
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting
    const identifier = getClientIdentifier(request)
    if (!twoFactorLimiter.check(identifier)) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please try again later." },
        { status: 429 }
      )
    }

    // CSRF validation
    const headerToken = request.headers.get("X-CSRF-Token")
    const cookieToken = await getCsrfTokenFromCookies()
    if (!verifyCsrfToken(headerToken, cookieToken)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    // Validate request body
    const body = await request.json()
    const validation = verifyLoginSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0].message }, { status: 400 })
    }

    const { email, code, twoFactorToken } = validation.data

    // Verify the temporary 2FA token (stored during initial password verification)
    // This token is a hash of email + timestamp, valid for 5 minutes
    const expectedToken = await get2FAToken(email)
    if (!expectedToken || expectedToken !== twoFactorToken) {
      return NextResponse.json(
        { error: "Invalid or expired session. Please log in again." },
        { status: 400 }
      )
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorBackupCodes: true,
      },
    })

    if (!user) {
      // Consistent response to prevent user enumeration
      return NextResponse.json({ error: "Invalid verification code" }, { status: 400 })
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json(
        { error: "Two-factor authentication is not enabled for this account" },
        { status: 400 }
      )
    }

    // Verify TOTP code or backup code
    let isCodeValid = false
    let usedBackupCodeIndex = -1

    // First try TOTP code (6 digits)
    if (code.length === 6 && /^\d+$/.test(code)) {
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

    // If backup code was used, remove it
    if (usedBackupCodeIndex !== -1) {
      const updatedBackupCodes = [...user.twoFactorBackupCodes]
      updatedBackupCodes.splice(usedBackupCodeIndex, 1)

      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorBackupCodes: updatedBackupCodes,
        },
      })
    }

    // Clear the 2FA token
    await clear2FAToken(email)

    return NextResponse.json({
      success: true,
      message: "Two-factor authentication verified",
      usedBackupCode: usedBackupCodeIndex !== -1,
      remainingBackupCodes:
        usedBackupCodeIndex !== -1 ? user.twoFactorBackupCodes.length - 1 : undefined,
    })
  } catch (error) {
    console.error("2FA login verification error:", error)
    return NextResponse.json(
      { error: "Failed to verify two-factor authentication" },
      { status: 500 }
    )
  }
}
