import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { getSafePostAuthPath } from "@/app/lib/clerk-auth"
import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import {
  applyFallbackSessionCookie,
  createFallbackSession,
  findFallbackUserByEmail,
  isFallbackAuthEnabled,
  verifyFallbackPassword,
} from "@/app/lib/fallback-auth"

const signInSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
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
  const validation = signInSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
  }

  const { email, password, redirectPath } = validation.data
  const fallbackUser = await findFallbackUserByEmail(email)

  if (!fallbackUser?.hashedPassword) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 })
  }

  const isPasswordValid = await verifyFallbackPassword(password, fallbackUser.hashedPassword)
  if (!isPasswordValid) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 })
  }

  const { sessionToken, expiresAt } = await createFallbackSession(fallbackUser.id)
  const response = NextResponse.json({
    authMode: "fallback",
    redirectPath: getSafePostAuthPath(redirectPath),
    user: {
      id: fallbackUser.id,
      email: fallbackUser.email,
      image: fallbackUser.image,
      name: fallbackUser.name,
    },
  })

  applyFallbackSessionCookie(response, sessionToken, expiresAt)

  return response
}
