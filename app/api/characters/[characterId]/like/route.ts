import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import { canAccessNsfw } from "@/app/lib/nsfw"
import prisma from "@/app/lib/prismadb"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
): Promise<NextResponse> {
  const identifier = getClientIdentifier(request)
  const allowed = await Promise.resolve(apiLimiter.check(identifier))
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const headerToken = request.headers.get("X-CSRF-Token")
  const cookieToken = getCsrfTokenFromRequest(request)
  if (!verifyCsrfToken(headerToken, cookieToken)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const currentUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, isAdult: true, nsfwEnabled: true, adultConfirmedAt: true },
  })
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 401 })
  }

  try {
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

    const existing = await prisma.characterLike.findUnique({
      where: {
        userId_characterId: {
          userId: currentUser.id,
          characterId,
        },
      },
    })

    if (existing) {
      return NextResponse.json({ error: "Already liked" }, { status: 409 })
    }

    await prisma.$transaction([
      prisma.characterLike.create({
        data: { userId: currentUser.id, characterId },
      }),
      prisma.character.update({
        where: { id: characterId },
        data: { likeCount: { increment: 1 } },
      }),
    ])

    return NextResponse.json({ liked: true })
  } catch (error) {
    console.error("[CHARACTER_LIKE]", error)
    return NextResponse.json({ error: "Failed to like character" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
): Promise<NextResponse> {
  const identifier = getClientIdentifier(request)
  const allowed = await Promise.resolve(apiLimiter.check(identifier))
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const headerToken = request.headers.get("X-CSRF-Token")
  const cookieToken = getCsrfTokenFromRequest(request)
  if (!verifyCsrfToken(headerToken, cookieToken)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const currentUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, isAdult: true, nsfwEnabled: true, adultConfirmedAt: true },
  })
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 401 })
  }

  try {
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

    const existing = await prisma.characterLike.findUnique({
      where: {
        userId_characterId: {
          userId: currentUser.id,
          characterId,
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Not liked" }, { status: 404 })
    }

    await prisma.$transaction([
      prisma.characterLike.delete({
        where: {
          userId_characterId: {
            userId: currentUser.id,
            characterId,
          },
        },
      }),
      prisma.character.update({
        where: { id: characterId },
        data: { likeCount: { decrement: 1 } },
      }),
    ])

    return NextResponse.json({ liked: false })
  } catch (error) {
    console.error("[CHARACTER_UNLIKE]", error)
    return NextResponse.json({ error: "Failed to unlike character" }, { status: 500 })
  }
}
