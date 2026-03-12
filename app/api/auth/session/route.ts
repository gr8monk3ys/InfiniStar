import { NextResponse } from "next/server"

import { getAuthSession } from "@/app/lib/auth"

export async function GET() {
  const session = await getAuthSession()

  return NextResponse.json({
    authMode: session?.authMode ?? null,
    isSignedIn: Boolean(session),
    user: session?.user ?? null,
  })
}
