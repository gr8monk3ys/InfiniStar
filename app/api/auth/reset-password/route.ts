import { NextResponse, type NextRequest } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"

import { isTokenExpired } from "@/app/lib/email-verification"
import prisma from "@/app/lib/prismadb"
import { authLimiter, getClientIdentifier } from "@/app/lib/rate-limit"

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

/**
 * Reset Password Endpoint
 *
 * POST /api/auth/reset-password
 *
 * Resets a user's password using a valid reset token
 * Rate limited to prevent brute force attacks
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
    const body = await request.json()

    // Validate input
    const validation = resetPasswordSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
    }

    const { token, password } = validation.data

    // Find user by reset token
    const user = await prisma.user.findUnique({
      where: { resetToken: token },
    })

    if (!user || !user.resetToken) {
      return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 400 })
    }

    // Check if token is expired
    if (isTokenExpired(user.resetTokenExpiry)) {
      return NextResponse.json(
        { error: "Reset token has expired. Please request a new one." },
        { status: 400 }
      )
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    })

    return NextResponse.json({
      message: "Password reset successfully! You can now log in with your new password.",
    })
  } catch (error) {
    console.error("Password reset error:", error)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}
