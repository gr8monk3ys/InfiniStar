import { NextResponse, type NextRequest } from "next/server"

import { sendPasswordResetEmail } from "@/app/lib/email"
import { generateVerificationToken, getTokenExpiry } from "@/app/lib/email-verification"
import prisma from "@/app/lib/prismadb"
import { authLimiter, getClientIdentifier } from "@/app/lib/rate-limit"

/**
 * Request Password Reset Endpoint
 *
 * POST /api/auth/request-reset
 *
 * Generates a password reset token and sends it via email
 * Rate limited to prevent abuse
 */
export async function POST(request: NextRequest) {
  // Rate limiting - 5 requests per 5 minutes
  const identifier = getClientIdentifier(request)
  if (!authLimiter.check(identifier)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a few minutes." },
      { status: 429, headers: { "Retry-After": "300" } }
    )
  }

  try {
    const { email } = await request.json()

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    // Don't reveal whether user exists (security best practice)
    // Always return success message to prevent user enumeration
    const successMessage =
      "If an account exists with that email, you will receive a password reset link."

    if (!user) {
      // Still return success to prevent user enumeration
      return NextResponse.json({ message: successMessage })
    }

    // Generate reset token
    const resetToken = generateVerificationToken()
    const resetTokenExpiry = getTokenExpiry() // 24 hours

    // Store reset token in database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    })

    // Send password reset email
    await sendPasswordResetEmail(user.email!, user.name || "User", resetToken)

    return NextResponse.json({ message: successMessage })
  } catch (error) {
    console.error("Password reset request error:", error)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}
