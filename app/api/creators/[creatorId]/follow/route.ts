import { NextResponse, type NextRequest } from "next/server"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"

function validateCsrf(request: NextRequest): boolean {
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

  return verifyCsrfToken(headerToken, cookieToken)
}

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
    console.error("FOLLOW_STATUS_GET_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { creatorId } = await params

    // CSRF Protection
    if (!validateCsrf(request)) {
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
    console.error("FOLLOW_CREATE_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { creatorId } = await params

    // CSRF Protection
    if (!validateCsrf(request)) {
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
    console.error("FOLLOW_DELETE_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
