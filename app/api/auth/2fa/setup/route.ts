import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import QRCode from "qrcode"

import { authOptions } from "@/app/lib/auth"
import { getCsrfTokenFromCookies, verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { authLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import { encryptSecret, generateTOTPAuthURL, generateTOTPSecret } from "@/app/lib/two-factor"

/**
 * POST /api/auth/2fa/setup
 *
 * Generate TOTP secret and QR code for 2FA setup
 * Returns the secret (for manual entry) and QR code data URL
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting
    const identifier = getClientIdentifier(request)
    if (!authLimiter.check(identifier)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
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

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
        hashedPassword: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if user has a password (credentials account)
    if (!user.hashedPassword) {
      return NextResponse.json(
        { error: "Two-factor authentication is only available for accounts with a password" },
        { status: 400 }
      )
    }

    // Check if 2FA is already enabled
    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { error: "Two-factor authentication is already enabled" },
        { status: 400 }
      )
    }

    // Generate new TOTP secret
    const secret = generateTOTPSecret()
    const authUrl = generateTOTPAuthURL(secret, user.email!)

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(authUrl, {
      width: 256,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    })

    // Store encrypted secret temporarily (will be finalized on verification)
    const encryptedSecret = encryptSecret(secret)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: encryptedSecret,
      },
    })

    return NextResponse.json({
      secret, // For manual entry in authenticator app
      qrCode: qrCodeDataUrl,
      message: "Scan the QR code with your authenticator app, then verify with a code",
    })
  } catch (error) {
    console.error("2FA setup error:", error)
    return NextResponse.json(
      { error: "Failed to set up two-factor authentication" },
      { status: 500 }
    )
  }
}
