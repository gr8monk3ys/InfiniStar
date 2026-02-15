import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { verifyCsrfToken } from "@/app/lib/csrf"
import { canAccessNsfw } from "@/app/lib/nsfw"
import prisma from "@/app/lib/prismadb"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import { sanitizePlainText } from "@/app/lib/sanitize"
import { slugify } from "@/app/lib/slug"

function getCsrfTokens(request: NextRequest): {
  headerToken: string | null
  cookieToken: string | null
} {
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

  return { headerToken, cookieToken }
}

/**
 * POST /api/characters/[characterId]/remix
 *
 * Clone a public character into the current user's library for editing.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
): Promise<NextResponse> {
  const identifier = getClientIdentifier(request)
  const allowed = await Promise.resolve(apiLimiter.check(identifier))
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const { headerToken, cookieToken } = getCsrfTokens(request)
  if (!verifyCsrfToken(headerToken, cookieToken)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const currentUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, isAdult: true, nsfwEnabled: true },
  })
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 401 })
  }

  const { characterId } = await params

  const original = await prisma.character.findUnique({
    where: { id: characterId },
    select: {
      id: true,
      name: true,
      tagline: true,
      description: true,
      greeting: true,
      systemPrompt: true,
      avatarUrl: true,
      coverImageUrl: true,
      tags: true,
      category: true,
      isPublic: true,
      isNsfw: true,
    },
  })

  if (!original || !original.isPublic) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 })
  }

  if (original.isNsfw && !canAccessNsfw(currentUser)) {
    return NextResponse.json({ error: "NSFW content is not enabled." }, { status: 403 })
  }

  const remixNameRaw = `${original.name} (Remix)`
  const remixName = sanitizePlainText(remixNameRaw).slice(0, 60)
  if (!remixName || remixName.length < 3) {
    return NextResponse.json({ error: "Unable to remix character name" }, { status: 400 })
  }

  const baseSlug = slugify(remixName)
  let slug = baseSlug
  let suffix = 1

  while (await prisma.character.findUnique({ where: { slug } })) {
    suffix += 1
    slug = `${baseSlug}-${suffix}`
  }

  const character = await prisma.character.create({
    data: {
      name: remixName,
      slug,
      tagline: original.tagline,
      description: original.description,
      greeting: original.greeting,
      systemPrompt: original.systemPrompt,
      avatarUrl: original.avatarUrl,
      coverImageUrl: original.coverImageUrl,
      tags: original.tags,
      category: original.category,
      isPublic: false,
      isNsfw: original.isNsfw,
      createdById: currentUser.id,
    },
  })

  return NextResponse.json(character, { status: 201 })
}
