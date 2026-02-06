import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"

import { authOptions } from "@/app/lib/auth"
import { getCsrfTokenFromCookies, verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { getClientIdentifier, twoFactorLimiter } from "@/app/lib/rate-limit"
import {
  decryptSecret,
  formatBackupCode,
  generateBackupCodes,
  verifyTOTPCode,
} from "@/app/lib/two-factor"

const verifySchema = z.object({
  code: z
    .string()
    .length(6, "Code must be exactly 6 digits")
    .regex(/^\d+$/, "Code must contain only digits"),
})

/**
 * POST /api/auth/2fa/verify
 *
 * Verify TOTP code and enable 2FA
 * Returns backup codes (shown only once)
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

    // Authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Validate request body
    const body = await request.json()
    const validation = verifySchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
    }

    const { code } = validation.data

    // Get user with 2FA secret
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { error: "Two-factor authentication is already enabled" },
        { status: 400 }
      )
    }

    if (!user.twoFactorSecret) {
      return NextResponse.json(
        { error: "Please start the 2FA setup process first" },
        { status: 400 }
      )
    }

    // Decrypt and verify the TOTP code
    const secret = decryptSecret(user.twoFactorSecret)
    const isValid = verifyTOTPCode(code, secret)

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid verification code. Please try again." },
        { status: 400 }
      )
    }

    // Generate backup codes
    const { plainCodes, hashedCodes } = generateBackupCodes(10)

    // Enable 2FA and store backup codes
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorBackupCodes: hashedCodes,
      },
    })

    // Format backup codes for display
    const formattedCodes = plainCodes.map(formatBackupCode)

    return NextResponse.json({
      message: "Two-factor authentication enabled successfully",
      backupCodes: formattedCodes,
      warning: "Save these backup codes in a secure location. They will not be shown again.",
    })
  } catch (error) {
    console.error("2FA verification error:", error)
    return NextResponse.json(
      { error: "Failed to verify two-factor authentication" },
      { status: 500 }
    )
  }
}
