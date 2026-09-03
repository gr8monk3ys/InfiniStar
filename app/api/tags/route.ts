import { NextResponse } from "next/server"
import { z } from "zod"

import { guard } from "@/app/lib/guarded-route"
import prisma from "@/app/lib/prismadb"
import { tagLimiter } from "@/app/lib/rate-limit"
import { sanitizePlainText } from "@/app/lib/sanitize"
import { TAG_COLORS, type TagColor } from "@/app/types"

const TAG_COLOR_KEYS = Object.keys(TAG_COLORS) as TagColor[]

const createTagSchema = z.object({
  name: z
    .string()
    .min(1, "Tag name is required")
    .max(30, "Tag name must be 30 characters or less")
    .trim(),
  color: z.enum(TAG_COLOR_KEYS as [TagColor, ...TagColor[]], { message: "Invalid tag color" }),
})

const MAX_TAGS_PER_USER = 20

/**
 * GET /api/tags - every tag belonging to the current user, with its
 * conversation count.
 */
export const GET = guard({}, async ({ user }) => {
  const tags = await prisma.tag.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
    include: { _count: { select: { conversations: true } } },
  })

  const tagsWithCount = tags.map(({ _count, ...tag }) => ({
    ...tag,
    conversationCount: _count.conversations,
  }))

  return NextResponse.json({ tags: tagsWithCount })
})

/**
 * POST /api/tags - create a tag for the current user.
 */
export const POST = guard(
  { limiter: tagLimiter, body: createTagSchema },
  async ({ user, body }) => {
    const name = sanitizePlainText(body.name)
    if (!name) {
      return NextResponse.json({ error: "Invalid tag name" }, { status: 400 })
    }

    const existingTag = await prisma.tag.findUnique({
      where: { userId_name: { userId: user.id, name } },
    })
    if (existingTag) {
      return NextResponse.json({ error: "A tag with this name already exists" }, { status: 409 })
    }

    const tagCount = await prisma.tag.count({ where: { userId: user.id } })
    if (tagCount >= MAX_TAGS_PER_USER) {
      return NextResponse.json(
        {
          error: `Maximum tag limit (${MAX_TAGS_PER_USER}) reached. Please delete some tags first.`,
        },
        { status: 400 }
      )
    }

    const newTag = await prisma.tag.create({
      data: { name, color: body.color, userId: user.id },
    })

    return NextResponse.json({ tag: { ...newTag, conversationCount: 0 } })
  }
)
