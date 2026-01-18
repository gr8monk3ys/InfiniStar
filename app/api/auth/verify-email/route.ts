import { NextResponse, type NextRequest } from "next/server"

import { sendWelcomeEmail } from "@/app/lib/email"
import { isTokenExpired } from "@/app/lib/email-verification"
import prisma from "@/app/lib/prismadb"

/**
 * POST /api/auth/verify-email
 *
 * Verify user's email address using verification token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json({ error: "Verification token is required" }, { status: 400 })
    }

    // Find user with this verification token
    const user = await prisma.user.findUnique({
      where: { verificationToken: token },
    })

    if (!user) {
      return NextResponse.json({ error: "Invalid verification token" }, { status: 400 })
    }

    // Check if token has expired
    if (isTokenExpired(user.verificationTokenExpiry)) {
      return NextResponse.json(
        { error: "Verification token has expired. Please request a new one." },
        { status: 400 }
      )
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json({ message: "Email already verified" }, { status: 200 })
    }

    // Update user to mark email as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    })

    // Send welcome email
    if (user.email && user.name) {
      await sendWelcomeEmail(user.email, user.name)
    }

    return NextResponse.json({ message: "Email verified successfully!" }, { status: 200 })
  } catch (error) {
    console.error("Email verification error:", error)
    return NextResponse.json({ error: "Failed to verify email" }, { status: 500 })
  }
}
