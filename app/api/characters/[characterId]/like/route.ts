import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/app/lib/auth'
import { verifyCsrfToken } from '@/app/lib/csrf'
import prisma from '@/app/lib/prismadb'
import { apiLimiter, getClientIdentifier } from '@/app/lib/rate-limit'

function getCsrfTokens(request: NextRequest): {
  headerToken: string | null
  cookieToken: string | null
} {
  const headerToken = request.headers.get('X-CSRF-Token')
  const cookieHeader = request.headers.get('cookie')
  let cookieToken: string | null = null

  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce(
      (acc, cookie) => {
        const [key, value] = cookie.trim().split('=')
        acc[key] = value
        return acc
      },
      {} as Record<string, string>
    )
    cookieToken = cookies['csrf-token'] || null
  }

  return { headerToken, cookieToken }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
): Promise<NextResponse> {
  const identifier = getClientIdentifier(request)
  if (!apiLimiter.check(identifier)) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    )
  }

  const { headerToken, cookieToken } = getCsrfTokens(request)
  if (!verifyCsrfToken(headerToken, cookieToken)) {
    return NextResponse.json(
      { error: 'Invalid CSRF token' },
      { status: 403 }
    )
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { characterId } = await params

    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { id: true, isPublic: true },
    })

    if (!character || !character.isPublic) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      )
    }

    const existing = await prisma.characterLike.findUnique({
      where: {
        userId_characterId: {
          userId: session.user.id,
          characterId,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Already liked' },
        { status: 409 }
      )
    }

    await prisma.$transaction([
      prisma.characterLike.create({
        data: { userId: session.user.id, characterId },
      }),
      prisma.character.update({
        where: { id: characterId },
        data: { likeCount: { increment: 1 } },
      }),
    ])

    return NextResponse.json({ liked: true })
  } catch (error) {
    console.error('[CHARACTER_LIKE]', error)
    return NextResponse.json(
      { error: 'Failed to like character' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
): Promise<NextResponse> {
  const identifier = getClientIdentifier(request)
  if (!apiLimiter.check(identifier)) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    )
  }

  const { headerToken, cookieToken } = getCsrfTokens(request)
  if (!verifyCsrfToken(headerToken, cookieToken)) {
    return NextResponse.json(
      { error: 'Invalid CSRF token' },
      { status: 403 }
    )
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { characterId } = await params

    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { id: true, isPublic: true },
    })

    if (!character || !character.isPublic) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      )
    }

    const existing = await prisma.characterLike.findUnique({
      where: {
        userId_characterId: {
          userId: session.user.id,
          characterId,
        },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Not liked' },
        { status: 404 }
      )
    }

    await prisma.$transaction([
      prisma.characterLike.delete({
        where: {
          userId_characterId: {
            userId: session.user.id,
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
    console.error('[CHARACTER_UNLIKE]', error)
    return NextResponse.json(
      { error: 'Failed to unlike character' },
      { status: 500 }
    )
  }
}
