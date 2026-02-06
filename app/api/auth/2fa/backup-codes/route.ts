import { NextResponse, type NextRequest } from "next/server"
import bcrypt from "bcryptjs"
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

const regenerateSchema = z.object({
  password: z.string().min(1, "Password is required"),
  code: z
    .string()
    .length(6, "TOTP code must be 6 digits")
    .regex(/^\d+$/, "Code must be digits only"),
})

/**
 * GET /api/auth/2fa/backup-codes
 *
 * Get the count of remaining backup codes (does not expose the codes themselves)
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        twoFactorEnabled: true,
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

    return NextResponse.json({
      remainingCodes: user.twoFactorBackupCodes.length,
    })
  } catch (error) {
    console.error("Get backup codes count error:", error)
    return NextResponse.json({ error: "Failed to get backup codes count" }, { status: 500 })
  }
}

/**
 * POST /api/auth/2fa/backup-codes
 *
 * Generate new backup codes (requires password and TOTP code)
 * This replaces all existing backup codes
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
    const validation = regenerateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
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
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
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

    // Verify TOTP code
    const secret = decryptSecret(user.twoFactorSecret)
    const isCodeValid = verifyTOTPCode(code, secret)

    if (!isCodeValid) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 400 })
    }

    // Generate new backup codes
    const { plainCodes, hashedCodes } = generateBackupCodes(10)

    // Update backup codes
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorBackupCodes: hashedCodes,
      },
    })

    // Format backup codes for display
    const formattedCodes = plainCodes.map(formatBackupCode)

    return NextResponse.json({
      message: "New backup codes generated successfully",
      backupCodes: formattedCodes,
      warning:
        "Save these backup codes in a secure location. They will not be shown again. All previous backup codes have been invalidated.",
    })
  } catch (error) {
    console.error("Regenerate backup codes error:", error)
    return NextResponse.json({ error: "Failed to generate new backup codes" }, { status: 500 })
  }
}
