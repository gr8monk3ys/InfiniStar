import { NextResponse, type NextRequest } from "next/server"

import { getAuthSession } from "@/app/lib/auth"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"

export async function GET(request: NextRequest) {
  const identifier = getClientIdentifier(request)
  const allowed = await Promise.resolve(apiLimiter.check(identifier))
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const session = await getAuthSession()

  return NextResponse.json({
    authMode: session?.authMode ?? null,
    isSignedIn: Boolean(session),
    user: session?.user ?? null,
  })
}
