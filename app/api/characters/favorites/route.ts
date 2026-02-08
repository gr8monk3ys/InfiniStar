import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/app/lib/auth'
import prisma from '@/app/lib/prismadb'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor')
  const limit = Math.min(
    parseInt(searchParams.get('limit') || '20', 10),
    50
  )

  try {
    const likes = await prisma.characterLike.findMany({
      where: { userId: session.user.id },
      include: {
        character: {
          include: {
            createdBy: {
              select: { id: true, name: true, image: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = likes.length > limit
    const items = hasMore ? likes.slice(0, limit) : likes

    return NextResponse.json({
      characters: items.map((like: { character: Record<string, unknown>; createdAt: Date; id: string }) => ({
        ...like.character,
        likedAt: like.createdAt,
      })),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    })
  } catch (error) {
    console.error('[FAVORITES]', error)
    return NextResponse.json(
      { error: 'Failed to fetch favorites' },
      { status: 500 }
    )
  }
}
