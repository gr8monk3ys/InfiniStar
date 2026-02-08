import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"

import prisma from "@/app/lib/prismadb"

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const currentUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  })
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get("cursor")
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50)

  try {
    const likes = await prisma.characterLike.findMany({
      where: { userId: currentUser.id },
      include: {
        character: {
          include: {
            createdBy: {
              select: { id: true, name: true, image: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = likes.length > limit
    const items = hasMore ? likes.slice(0, limit) : likes

    return NextResponse.json({
      characters: items.map(
        (like: { character: Record<string, unknown>; createdAt: Date; id: string }) => ({
          ...like.character,
          likedAt: like.createdAt,
        })
      ),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    })
  } catch (error) {
    console.error("[FAVORITES]", error)
    return NextResponse.json({ error: "Failed to fetch favorites" }, { status: 500 })
  }
}
