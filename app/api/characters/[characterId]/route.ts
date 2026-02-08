import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"

import { authOptions } from "@/app/lib/auth"
import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { sanitizePlainText } from "@/app/lib/sanitize"
import { slugify } from "@/app/lib/slug"

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
  featured: z.boolean().optional(),
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

  if (!character.isPublic) {
    const session = await getServerSession(authOptions)
    const currentUser = session?.user
    if (!currentUser?.id || character.createdById !== currentUser.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }
  }

  return NextResponse.json(character)
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

  if (data.name) {
    const sanitized = sanitizePlainText(data.name)
    if (!sanitized) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 })
    }
    const baseSlug = slugify(sanitized)
    slug = baseSlug
    let suffix = 1
    while (await prisma.character.findFirst({ where: { slug, NOT: { id: existing.id } } })) {
      suffix += 1
      slug = `${baseSlug}-${suffix}`
    }
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
      featured: data.featured,
      category: data.category ? sanitizePlainText(data.category) || undefined : undefined,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
