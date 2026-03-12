import { NextResponse, type NextRequest } from "next/server"

import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
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

  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 401 })
  }

  const { commentId } = await params

  try {
    const comment = await prisma.characterComment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        authorId: true,
        characterId: true,
        character: {
          select: { createdById: true },
        },
      },
    })

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }

    const canDelete =
      comment.authorId === currentUser.id || comment.character.createdById === currentUser.id
    if (!canDelete) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.$transaction([
      prisma.characterComment.delete({ where: { id: commentId } }),
      prisma.character.update({
        where: { id: comment.characterId },
        data: { commentCount: { decrement: 1 } },
      }),
      // Clamp counters to prevent negative values in case of drift.
      prisma.character.updateMany({
        where: { id: comment.characterId, commentCount: { lt: 0 } },
        data: { commentCount: 0 },
      }),
    ])

    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error("[CHARACTER_COMMENT_DELETE]", error)
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 })
  }
}
