import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"

import { authOptions } from "@/app/lib/auth"
import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"

const reportSchema = z.object({
  targetType: z.enum(["USER", "MESSAGE", "CONVERSATION", "CHARACTER"]),
  targetId: z.string().min(1),
  reason: z.enum(["HARASSMENT", "HATE", "SEXUAL", "VIOLENCE", "SPAM", "COPYRIGHT", "OTHER"]),
  details: z.string().max(2000).optional(),
})

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const currentUser = session?.user

  if (!currentUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const headerToken = request.headers.get("X-CSRF-Token")
  const cookieHeader = request.headers.get("cookie")
  let cookieToken: string | null = null

  if (cookieHeader) {
    const cookies = cookieHeader.split(";").reduce(
      (acc, cookie) => {
        const [key, value] = cookie.trim().split("=")
        acc[key] = value
        return acc
      },
      {} as Record<string, string>
    )
    cookieToken = cookies["csrf-token"] || null
  }

  if (!verifyCsrfToken(headerToken, cookieToken)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  const body = await request.json()
  const validation = reportSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
  }

  const report = await prisma.contentReport.create({
    data: {
      reporterId: currentUser.id,
      targetType: validation.data.targetType,
      targetId: validation.data.targetId,
      reason: validation.data.reason,
      details: validation.data.details,
    },
  })

  return NextResponse.json({ report }, { status: 201 })
}
