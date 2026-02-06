import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"

import { authOptions } from "@/app/lib/auth"
import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { sanitizePlainText } from "@/app/lib/sanitize"
import { slugify } from "@/app/lib/slug"

const createCharacterSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(60),
  tagline: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  greeting: z.string().max(500).optional(),
  systemPrompt: z.string().min(10, "System prompt is required").max(4000),
  avatarUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
  isPublic: z.boolean().optional(),
})

const listSchema = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
  featured: z.string().optional(),
  limit: z.string().optional(),
  cursor: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const params = listSchema.parse(Object.fromEntries(searchParams.entries()))

  const limit = Math.min(Number(params.limit || 24), 50)
  const cursor = params.cursor || undefined
  const featured = params.featured === "true"

  const where: {
    isPublic: boolean
    featured?: boolean
    OR?: Array<{
      name?: { contains: string; mode: "insensitive" }
      description?: { contains: string; mode: "insensitive" }
    }>
    tags?: { has: string }
  } = {
    isPublic: true,
  }

  if (featured) {
    where.featured = true
  }

  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { description: { contains: params.q, mode: "insensitive" } },
    ]
  }

  if (params.tag) {
    where.tags = { has: params.tag }
  }

  const characters = await prisma.character.findMany({
    where,
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: [{ featured: "desc" }, { usageCount: "desc" }, { createdAt: "desc" }],
    include: {
      createdBy: {
        select: { id: true, name: true, image: true },
      },
    },
  })

  let nextCursor: string | null = null
  if (characters.length > limit) {
    const nextItem = characters.pop()
    nextCursor = nextItem?.id ?? null
  }

  return NextResponse.json({ characters, nextCursor })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const currentUser = session?.user

  if (!currentUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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

  const body = await request.json()
  const validation = createCharacterSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
  }

  const data = validation.data
  const sanitizedName = sanitizePlainText(data.name)

  if (!sanitizedName) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 })
  }

  const baseSlug = slugify(sanitizedName)
  let slug = baseSlug
  let suffix = 1

  while (await prisma.character.findUnique({ where: { slug } })) {
    suffix += 1
    slug = `${baseSlug}-${suffix}`
  }

  const character = await prisma.character.create({
    data: {
      name: sanitizedName,
      slug,
      tagline: data.tagline ? sanitizePlainText(data.tagline) : null,
      description: data.description ? sanitizePlainText(data.description) : null,
      greeting: data.greeting ? sanitizePlainText(data.greeting) : null,
      systemPrompt: data.systemPrompt,
      avatarUrl: data.avatarUrl,
      coverImageUrl: data.coverImageUrl,
      tags: data.tags?.map((tag) => sanitizePlainText(tag)).filter(Boolean) as string[],
      isPublic: data.isPublic ?? false,
      createdById: currentUser.id,
    },
  })

  return NextResponse.json(character, { status: 201 })
}
