import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"

import { authOptions } from "@/app/lib/auth"
import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { getClientIdentifier, tagLimiter } from "@/app/lib/rate-limit"
import { sanitizePlainText } from "@/app/lib/sanitize"
import { TAG_COLORS, type TagColor } from "@/app/types"

const TAG_COLOR_KEYS = Object.keys(TAG_COLORS) as TagColor[]

// Validation schema for creating a tag
const createTagSchema = z.object({
  name: z
    .string()
    .min(1, "Tag name is required")
    .max(30, "Tag name must be 30 characters or less")
    .trim(),
  color: z.enum(TAG_COLOR_KEYS as [TagColor, ...TagColor[]], { message: "Invalid tag color" }),
})

/**
 * GET /api/tags
 * Get all tags for the current user
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const currentUser = session?.user

    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tags = await prisma.tag.findMany({
      where: {
        userId: currentUser.id,
      },
      orderBy: {
        name: "asc",
      },
      include: {
        _count: {
          select: {
            conversations: true,
          },
        },
      },
    })

    // Transform to include conversation count
    const tagsWithCount = tags.map((tag) => ({
      ...tag,
      conversationCount: tag._count.conversations,
      _count: undefined,
    }))

    return NextResponse.json({ tags: tagsWithCount })
  } catch (error) {
    console.error("Error fetching tags:", error)
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 })
  }
}

/**
 * POST /api/tags
 * Create a new tag for the current user
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = getClientIdentifier(request)
    if (!tagLimiter.check(identifier)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      )
    }

    // CSRF Protection
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

    const session = await getServerSession(authOptions)
    const currentUser = session?.user

    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Validate input
    const validationResult = createTagSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.issues[0].message }, { status: 400 })
    }

    const { name, color } = validationResult.data

    // Sanitize the tag name
    const sanitizedName = sanitizePlainText(name)

    if (!sanitizedName) {
      return NextResponse.json({ error: "Invalid tag name" }, { status: 400 })
    }

    // Check if tag with same name already exists for this user
    const existingTag = await prisma.tag.findUnique({
      where: {
        userId_name: {
          userId: currentUser.id,
          name: sanitizedName,
        },
      },
    })

    if (existingTag) {
      return NextResponse.json({ error: "A tag with this name already exists" }, { status: 409 })
    }

    // Check tag limit (max 20 tags per user)
    const tagCount = await prisma.tag.count({
      where: {
        userId: currentUser.id,
      },
    })

    if (tagCount >= 20) {
      return NextResponse.json(
        { error: "Maximum tag limit (20) reached. Please delete some tags first." },
        { status: 400 }
      )
    }

    // Create the tag
    const newTag = await prisma.tag.create({
      data: {
        name: sanitizedName,
        color,
        userId: currentUser.id,
      },
    })

    return NextResponse.json({
      tag: {
        ...newTag,
        conversationCount: 0,
      },
    })
  } catch (error) {
    console.error("Error creating tag:", error)
    return NextResponse.json({ error: "Failed to create tag" }, { status: 500 })
  }
}
