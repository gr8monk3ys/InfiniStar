import { NextResponse, type NextRequest } from "next/server"

import { sendVerificationEmail } from "@/app/lib/email"
import { generateVerificationToken, getTokenExpiry } from "@/app/lib/email-verification"
import prisma from "@/app/lib/prismadb"
import { authLimiter, getClientIdentifier } from "@/app/lib/rate-limit"

/**
 * POST /api/auth/resend-verification
 *
 * Resend verification email to user
 */
export async function POST(request: NextRequest) {
  // Rate limiting
  const identifier = getClientIdentifier(request)
  if (!authLimiter.check(identifier)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "300" } }
    )
  }

  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      // Don't reveal if user exists or not (security best practice)
      return NextResponse.json(
        { message: "If an account exists, a verification email has been sent." },
        { status: 200 }
      )
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json({ error: "Email is already verified" }, { status: 400 })
    }

    // Generate new verification token
    const verificationToken = generateVerificationToken()
    const verificationTokenExpiry = getTokenExpiry()

    // Update user with new token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationTokenExpiry,
      },
    })

    // Send verification email
    await sendVerificationEmail(email, user.name || "User", verificationToken)

    return NextResponse.json({ message: "Verification email sent successfully" }, { status: 200 })
  } catch (error) {
    console.error("Resend verification error:", error)
    return NextResponse.json({ error: "Failed to send verification email" }, { status: 500 })
  }
}
