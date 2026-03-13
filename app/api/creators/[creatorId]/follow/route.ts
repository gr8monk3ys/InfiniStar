import { NextResponse, type NextRequest } from "next/server"

import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import { apiLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"

interface RouteParams {
  params: Promise<{
    creatorId: string
  }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { creatorId } = await params

    // Rate limiting
    const identifier = getClientIdentifier(request)
    const allowed = await Promise.resolve(apiLimiter.check(identifier))
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "60" } }
      )
    }

    const currentUser = await getCurrentUser()

    const [followerCount, followRow] = await Promise.all([
      prisma.userFollow.count({ where: { followingId: creatorId } }),
      currentUser?.id
        ? prisma.userFollow.findUnique({
            where: {
              followerId_followingId: {
                followerId: currentUser.id,
                followingId: creatorId,
              },
            },
            select: { followerId: true },
          })
        : Promise.resolve(null),
    ])

    return NextResponse.json({
      isFollowing: Boolean(followRow),
      followerCount,
    })
  } catch (error) {
    apiLogger.error({ err: error }, "FOLLOW_STATUS_GET_ERROR")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { creatorId } = await params

    // CSRF Protection
    if (!verifyCsrfToken(request.headers.get("X-CSRF-Token"), getCsrfTokenFromRequest(request))) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    // Rate limiting
    const identifier = getClientIdentifier(request)
    const allowed = await Promise.resolve(apiLimiter.check(identifier))
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "60" } }
      )
    }

    const currentUser = await getCurrentUser()
    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (creatorId === currentUser.id) {
      return NextResponse.json({ error: "You cannot follow yourself" }, { status: 400 })
    }

    await prisma.userFollow.upsert({
      where: {
        followerId_followingId: {
          followerId: currentUser.id,
          followingId: creatorId,
        },
      },
      create: {
        followerId: currentUser.id,
        followingId: creatorId,
      },
      update: {},
    })

    const followerCount = await prisma.userFollow.count({ where: { followingId: creatorId } })

    return NextResponse.json({
      isFollowing: true,
      followerCount,
    })
  } catch (error) {
    apiLogger.error({ err: error }, "FOLLOW_CREATE_ERROR")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { creatorId } = await params

    // CSRF Protection
    if (!verifyCsrfToken(request.headers.get("X-CSRF-Token"), getCsrfTokenFromRequest(request))) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    // Rate limiting
    const identifier = getClientIdentifier(request)
    const allowed = await Promise.resolve(apiLimiter.check(identifier))
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "60" } }
      )
    }

    const currentUser = await getCurrentUser()
    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (creatorId === currentUser.id) {
      return NextResponse.json({ error: "You cannot unfollow yourself" }, { status: 400 })
    }

    await prisma.userFollow.deleteMany({
      where: {
        followerId: currentUser.id,
        followingId: creatorId,
      },
    })

    const followerCount = await prisma.userFollow.count({ where: { followingId: creatorId } })

    return NextResponse.json({
      isFollowing: false,
      followerCount,
    })
  } catch (error) {
    apiLogger.error({ err: error }, "FOLLOW_DELETE_ERROR")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
