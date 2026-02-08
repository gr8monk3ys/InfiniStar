import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { z } from "zod"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { getClientIdentifier, tagLimiter } from "@/app/lib/rate-limit"
import { sanitizePlainText } from "@/app/lib/sanitize"
import { TAG_COLORS, type TagColor } from "@/app/types"

const TAG_COLOR_KEYS = Object.keys(TAG_COLORS) as TagColor[]

// Validation schema for updating a tag
const updateTagSchema = z.object({
  name: z
    .string()
    .min(1, "Tag name is required")
    .max(30, "Tag name must be 30 characters or less")
    .trim()
    .optional(),
  color: z
    .enum(TAG_COLOR_KEYS as [TagColor, ...TagColor[]], { message: "Invalid tag color" })
    .optional(),
})

interface RouteParams {
  params: Promise<{
    tagId: string
  }>
}

/**
 * GET /api/tags/[tagId]
 * Get a specific tag
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { tagId } = await params
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

    const tag = await prisma.tag.findUnique({
      where: {
        id: tagId,
      },
      include: {
        _count: {
          select: {
            conversations: true,
          },
        },
      },
    })

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 })
    }

    // Verify ownership
    if (tag.userId !== currentUser.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    return NextResponse.json({
      tag: {
        ...tag,
        conversationCount: tag._count.conversations,
        _count: undefined,
      },
    })
  } catch (error) {
    console.error("Error fetching tag:", error)
    return NextResponse.json({ error: "Failed to fetch tag" }, { status: 500 })
  }
}

/**
 * PATCH /api/tags/[tagId]
 * Update a tag
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { tagId } = await params

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

    // Find the existing tag
    const existingTag = await prisma.tag.findUnique({
      where: {
        id: tagId,
      },
    })

    if (!existingTag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 })
    }

    // Verify ownership
    if (existingTag.userId !== currentUser.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const body = await request.json()

    // Validate input
    const validationResult = updateTagSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.issues[0].message }, { status: 400 })
    }

    const { name, color } = validationResult.data

    // If name is being changed, sanitize and check for duplicates
    let sanitizedName: string | undefined
    if (name) {
      sanitizedName = sanitizePlainText(name)

      if (!sanitizedName) {
        return NextResponse.json({ error: "Invalid tag name" }, { status: 400 })
      }

      // Check if another tag with this name exists
      if (sanitizedName !== existingTag.name) {
        const duplicateTag = await prisma.tag.findUnique({
          where: {
            userId_name: {
              userId: currentUser.id,
              name: sanitizedName,
            },
          },
        })

        if (duplicateTag) {
          return NextResponse.json(
            { error: "A tag with this name already exists" },
            { status: 409 }
          )
        }
      }
    }

    // Update the tag
    const updatedTag = await prisma.tag.update({
      where: {
        id: tagId,
      },
      data: {
        ...(sanitizedName && { name: sanitizedName }),
        ...(color && { color }),
      },
      include: {
        _count: {
          select: {
            conversations: true,
          },
        },
      },
    })

    return NextResponse.json({
      tag: {
        ...updatedTag,
        conversationCount: updatedTag._count.conversations,
        _count: undefined,
      },
    })
  } catch (error) {
    console.error("Error updating tag:", error)
    return NextResponse.json({ error: "Failed to update tag" }, { status: 500 })
  }
}

/**
 * DELETE /api/tags/[tagId]
 * Delete a tag
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { tagId } = await params

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

    // Find the existing tag
    const existingTag = await prisma.tag.findUnique({
      where: {
        id: tagId,
      },
    })

    if (!existingTag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 })
    }

    // Verify ownership
    if (existingTag.userId !== currentUser.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Delete the tag (this will also remove it from all conversations due to the many-to-many relationship)
    await prisma.tag.delete({
      where: {
        id: tagId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting tag:", error)
    return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 })
  }
}
