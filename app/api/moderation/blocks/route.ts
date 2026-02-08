import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { z } from "zod"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"

const blockSchema = z.object({
  blockedUserId: z.string().uuid(),
  reason: z.string().max(500).optional(),
})

export async function GET() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const currentUser = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 401 })
  }

  const blocks = await prisma.userBlock.findMany({
    where: { blockerId: currentUser.id },
    include: {
      blocked: { select: { id: true, name: true, image: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ blocks })
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const currentUser = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 401 })
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
  const validation = blockSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
  }

  if (validation.data.blockedUserId === currentUser.id) {
    return NextResponse.json({ error: "You cannot block yourself" }, { status: 400 })
  }

  const block = await prisma.userBlock.upsert({
    where: {
      blockerId_blockedId: {
        blockerId: currentUser.id,
        blockedId: validation.data.blockedUserId,
      },
    },
    update: {
      reason: validation.data.reason,
    },
    create: {
      blockerId: currentUser.id,
      blockedId: validation.data.blockedUserId,
      reason: validation.data.reason,
    },
  })

  return NextResponse.json({ block }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const currentUser = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 401 })
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
  const validation = blockSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
  }

  await prisma.userBlock.deleteMany({
    where: {
      blockerId: currentUser.id,
      blockedId: validation.data.blockedUserId,
    },
  })

  return NextResponse.json({ success: true })
}
