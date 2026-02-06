import { NextResponse, type NextRequest } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"

import { sendVerificationEmail } from "@/app/lib/email"
import { generateVerificationToken, getTokenExpiry } from "@/app/lib/email-verification"
import prisma from "@/app/lib/prismadb"
import { authLimiter, getClientIdentifier } from "@/app/lib/rate-limit"

const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  name: z.string().min(1, "Name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export async function POST(request: NextRequest) {
  // Rate limiting for registration (stricter to prevent abuse)
  const identifier = getClientIdentifier(request)
  if (!authLimiter.check(identifier)) {
    return new NextResponse(
      JSON.stringify({
        error: "Too many registration attempts. Please try again in 5 minutes.",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "300",
        },
      }
    )
  }
  try {
    const body = await request.json()

    // Validate input
    const validationResult = registerSchema.safeParse(body)

    if (!validationResult.success) {
      return new NextResponse(validationResult.error.issues[0].message, { status: 422 })
    }

    const { email, name, password } = validationResult.data

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return new NextResponse("Email already registered", { status: 422 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    // Generate verification token
    const verificationToken = generateVerificationToken()
    const verificationTokenExpiry = getTokenExpiry()

    const user = await prisma.user.create({
      data: {
        email,
        name,
        hashedPassword,
        verificationToken,
        verificationTokenExpiry,
        emailVerified: null, // Not verified yet
      },
    })

    // Send verification email
    await sendVerificationEmail(email, name, verificationToken)

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      message: "Registration successful! Please check your email to verify your account.",
    })
  } catch (error) {
    console.error("Registration error:", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}
