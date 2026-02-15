import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { z } from "zod"

import { verifyCsrfToken } from "@/app/lib/csrf"
import { moderateTextModelAssisted } from "@/app/lib/moderation"
import { canAccessNsfw } from "@/app/lib/nsfw"
import prisma from "@/app/lib/prismadb"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import { sanitizePlainText } from "@/app/lib/sanitize"

const listSchema = z.object({
  limit: z.string().optional(),
  cursor: z.string().uuid().optional(),
})

const createSchema = z.object({
  body: z.string().min(1, "Comment cannot be empty").max(1000, "Comment too long (max 1000)"),
})

function getCsrfTokens(request: NextRequest): {
  headerToken: string | null
  cookieToken: string | null
} {
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

  return { headerToken, cookieToken }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
) {
  const identifier = getClientIdentifier(request)
  const allowed = await Promise.resolve(apiLimiter.check(identifier))
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const { characterId } = await params
  const { searchParams } = new URL(request.url)
  const parsedQuery = listSchema.safeParse(Object.fromEntries(searchParams.entries()))
  if (!parsedQuery.success) {
    return NextResponse.json({ error: parsedQuery.error.issues[0].message }, { status: 400 })
  }

  const limit = Math.min(parseInt(parsedQuery.data.limit || "20", 10), 50)
  const cursor = parsedQuery.data.cursor || undefined

  const { userId } = await auth()
  const currentUser = userId
    ? await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true, isAdult: true, nsfwEnabled: true },
      })
    : null
  const allowNsfw = canAccessNsfw(currentUser)

  const character = await prisma.character.findUnique({
    where: { id: characterId },
    select: { id: true, isPublic: true, isNsfw: true, createdById: true },
  })

  if (!character || !character.isPublic) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 })
  }

  if (character.isNsfw && !allowNsfw) {
    return NextResponse.json({ error: "NSFW content is not enabled." }, { status: 403 })
  }

  const rows = await prisma.characterComment.findMany({
    where: { characterId },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      author: {
        select: { id: true, name: true, image: true },
      },
    },
  })

  let nextCursor: string | null = null
  if (rows.length > limit) {
    const nextItem = rows.pop()
    nextCursor = nextItem?.id ?? null
  }

  const comments = rows.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.createdAt,
    author: row.author,
    canDelete: Boolean(
      currentUser?.id &&
      (row.authorId === currentUser.id || character.createdById === currentUser.id)
    ),
  }))

  return NextResponse.json({ comments, nextCursor })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
) {
  const identifier = getClientIdentifier(request)
  const allowed = await Promise.resolve(apiLimiter.check(identifier))
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const { headerToken, cookieToken } = getCsrfTokens(request)
  if (!verifyCsrfToken(headerToken, cookieToken)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const currentUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, isAdult: true, nsfwEnabled: true },
  })
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 401 })
  }

  const body = await request.json()
  const validation = createSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
  }

  const { characterId } = await params

  const character = await prisma.character.findUnique({
    where: { id: characterId },
    select: { id: true, isPublic: true, isNsfw: true },
  })
  if (!character || !character.isPublic) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 })
  }

  if (character.isNsfw && !canAccessNsfw(currentUser)) {
    return NextResponse.json({ error: "NSFW content is not enabled." }, { status: 403 })
  }

  const sanitizedBody = sanitizePlainText(validation.data.body).trim()
  if (!sanitizedBody) {
    return NextResponse.json({ error: "Invalid comment" }, { status: 400 })
  }

  const moderationResult = await moderateTextModelAssisted(sanitizedBody)
  if (moderationResult.shouldBlock) {
    return NextResponse.json(
      {
        error: "Comment was blocked by safety filters.",
        code: "CONTENT_BLOCKED",
        categories: moderationResult.categories,
      },
      { status: 400 }
    )
  }

  const [comment, updatedCharacter] = await prisma.$transaction([
    prisma.characterComment.create({
      data: {
        body: sanitizedBody,
        characterId,
        authorId: currentUser.id,
      },
      include: {
        author: {
          select: { id: true, name: true, image: true },
        },
      },
    }),
    prisma.character.update({
      where: { id: characterId },
      data: { commentCount: { increment: 1 } },
      select: { commentCount: true },
    }),
  ])

  return NextResponse.json(
    {
      comment: {
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt,
        author: comment.author,
        canDelete: true,
      },
      commentCount: updatedCharacter.commentCount,
    },
    { status: 201 }
  )
}
