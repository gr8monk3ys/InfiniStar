import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import {
  buildModerationDetails,
  moderateTextModelAssisted,
  moderationReasonFromCategories,
} from "@/app/lib/moderation"
import { canAccessNsfw } from "@/app/lib/nsfw"
import prisma from "@/app/lib/prismadb"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import { sanitizePlainText } from "@/app/lib/sanitize"
import { slugify } from "@/app/lib/slug"
import getCurrentUser from "@/app/actions/getCurrentUser"

const updateCharacterSchema = z.object({
  name: z.string().min(3).max(60).optional(),
  tagline: z.string().max(120).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  greeting: z.string().max(500).optional().nullable(),
  systemPrompt: z.string().min(10).max(4000).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  coverImageUrl: z.string().url().optional().nullable(),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
  isPublic: z.boolean().optional(),
  isNsfw: z.boolean().optional(),
  // `featured` can only be set via admin endpoints - not included in user update schema
  category: z.string().max(50).optional(),
})

interface RouteParams {
  params: Promise<{ characterId: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { characterId } = await params
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
    },
  })

  if (!character) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 })
  }

  if (character.isPublic && character.isNsfw) {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const isOwner = currentUser?.id && character.createdById === currentUser.id
    if (!isOwner && !canAccessNsfw(currentUser)) {
      return NextResponse.json({ error: "NSFW content is not enabled." }, { status: 403 })
    }
  }

  if (!character.isPublic) {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }
    if (!currentUser || character.createdById !== currentUser.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }
  }

  return NextResponse.json(character)
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  // Rate limiting
  const identifier = getClientIdentifier(request)
  const allowed = await Promise.resolve(apiLimiter.check(identifier))
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    )
  }

  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 401 })
  }

  const headerToken = request.headers.get("X-CSRF-Token")
  const cookieToken = getCsrfTokenFromRequest(request)

  if (!verifyCsrfToken(headerToken, cookieToken)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  const { characterId } = await params
  const existing = await prisma.character.findUnique({ where: { id: characterId } })
  if (!existing) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 })
  }
  if (existing.createdById !== currentUser.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const body = await request.json()
  const validation = updateCharacterSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
  }

  const data = validation.data
  let slug = existing.slug

  const moderationPayload = [
    data.name ? sanitizePlainText(data.name) : null,
    data.tagline ? sanitizePlainText(data.tagline) : null,
    data.description ? sanitizePlainText(data.description) : null,
    data.greeting ? sanitizePlainText(data.greeting) : null,
    data.systemPrompt ?? null,
  ]
    .filter(Boolean)
    .join("\n")

  const moderationResult = moderationPayload
    ? await moderateTextModelAssisted(moderationPayload)
    : null
  if (moderationResult?.shouldBlock) {
    return NextResponse.json(
      {
        error: "Character content was blocked by safety filters.",
        code: "CONTENT_BLOCKED",
        categories: moderationResult.categories,
      },
      { status: 400 }
    )
  }

  if (data.isNsfw && !currentUser.isAdult) {
    return NextResponse.json(
      { error: "You must confirm you are 18+ to mark NSFW." },
      { status: 403 }
    )
  }

  if (data.name) {
    const sanitized = sanitizePlainText(data.name)
    if (!sanitized) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 })
    }
    const baseSlug = slugify(sanitized)
    const candidates = [baseSlug, ...Array.from({ length: 9 }, (_, i) => `${baseSlug}-${i + 2}`)]
    const takenSlugs = await prisma.character.findMany({
      where: { slug: { in: candidates }, NOT: { id: existing.id } },
      select: { slug: true },
    })
    const takenSet = new Set(takenSlugs.map((c: { slug: string }) => c.slug))
    const available = candidates.find((candidate) => !takenSet.has(candidate))
    slug = available ?? `${baseSlug}-${Date.now()}`
  }

  const updated = await prisma.character.update({
    where: { id: existing.id },
    data: {
      name: data.name ? sanitizePlainText(data.name) : undefined,
      slug,
      tagline: data.tagline ? sanitizePlainText(data.tagline) : data.tagline,
      description: data.description ? sanitizePlainText(data.description) : data.description,
      greeting: data.greeting ? sanitizePlainText(data.greeting) : data.greeting,
      systemPrompt: data.systemPrompt,
      avatarUrl: data.avatarUrl ?? undefined,
      coverImageUrl: data.coverImageUrl ?? undefined,
      tags: data.tags?.map((tag) => sanitizePlainText(tag)).filter(Boolean) as string[] | undefined,
      isPublic: data.isPublic,
      isNsfw: data.isNsfw,
      category: data.category ? sanitizePlainText(data.category) || undefined : undefined,
    },
  })

  if (moderationResult?.shouldReview) {
    await prisma.contentReport.create({
      data: {
        reporterId: currentUser.id,
        targetType: "CHARACTER",
        targetId: existing.id,
        reason: moderationReasonFromCategories(moderationResult.categories),
        details: buildModerationDetails(moderationResult, "character-update"),
        status: "OPEN",
      },
    })
  }

  return NextResponse.json(updated)
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 401 })
  }

  const headerToken = request.headers.get("X-CSRF-Token")
  const cookieToken = getCsrfTokenFromRequest(request)

  if (!verifyCsrfToken(headerToken, cookieToken)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  const { characterId } = await params
  const existing = await prisma.character.findUnique({ where: { id: characterId } })
  if (!existing) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 })
  }
  if (existing.createdById !== currentUser.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  await prisma.character.delete({ where: { id: existing.id } })
  return NextResponse.json({ success: true })
}
