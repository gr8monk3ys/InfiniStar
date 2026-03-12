import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { getSafePostAuthPath } from "@/app/lib/clerk-auth"
import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import {
  applyFallbackSessionCookie,
  createFallbackClerkId,
  createFallbackSession,
  hashFallbackPassword,
  isFallbackAuthEnabled,
} from "@/app/lib/fallback-auth"
import prisma from "@/app/lib/prismadb"

const signUpSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  name: z.string().trim().min(1, "Name is required.").max(100, "Name is too long."),
  redirectPath: z.string().optional(),
})

export async function POST(request: NextRequest) {
  if (!isFallbackAuthEnabled()) {
    return NextResponse.json({ error: "Backup auth is not enabled." }, { status: 404 })
  }

  if (!verifyCsrfToken(request.headers.get("X-CSRF-Token"), getCsrfTokenFromRequest(request))) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  const body = await request.json()
  const validation = signUpSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
  }

  const { email, password, name, redirectPath } = validation.data
  const normalizedEmail = email.toLowerCase()

  const existingUser = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: {
      id: true,
      hashedPassword: true,
    },
  })

  if (existingUser) {
    return NextResponse.json(
      {
        error: existingUser.hashedPassword
          ? "An account with that email already exists."
          : "That email is already linked to an account. Sign in with Clerk once and set a backup password from your profile.",
      },
      { status: 409 }
    )
  }

  const hashedPassword = await hashFallbackPassword(password)
  const user = await prisma.user.create({
    data: {
      clerkId: createFallbackClerkId(),
      email: normalizedEmail,
      emailVerified: new Date(),
      hashedPassword,
      name,
    },
    select: {
      id: true,
      email: true,
      image: true,
      name: true,
    },
  })

  const { sessionToken, expiresAt } = await createFallbackSession(user.id)
  const response = NextResponse.json({
    authMode: "fallback",
    redirectPath: getSafePostAuthPath(redirectPath),
    user,
  })

  applyFallbackSessionCookie(response, sessionToken, expiresAt)

  return response
}
