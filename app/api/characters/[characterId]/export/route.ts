import { NextResponse, type NextRequest } from "next/server"

import { toCharaCardV2 } from "@/app/lib/character-card-v2"
import { canAccessNsfw } from "@/app/lib/nsfw"
import prisma from "@/app/lib/prismadb"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"

/**
 * GET /api/characters/[characterId]/export
 *
 * Export a character as a V2 character card JSON file.
 * Public characters can be exported by anyone.
 * Private characters can only be exported by their creator.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
): Promise<NextResponse> {
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { characterId } = await params

  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: {
      createdBy: {
        select: { name: true },
      },
    },
  })

  if (!character) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 })
  }

  // Private characters can only be exported by their creator
  if (!character.isPublic && character.createdById !== currentUser.id) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 })
  }

  // NSFW check
  if (character.isNsfw && !canAccessNsfw(currentUser)) {
    return NextResponse.json({ error: "NSFW content is not enabled." }, { status: 403 })
  }

  const card = toCharaCardV2(
    {
      name: character.name,
      tagline: character.tagline,
      description: character.description,
      greeting: character.greeting,
      scenario: character.scenario,
      exampleDialogues: character.exampleDialogues,
      systemPrompt: character.systemPrompt,
      avatarUrl: character.avatarUrl,
      coverImageUrl: character.coverImageUrl,
      tags: character.tags,
      category: character.category,
      isNsfw: character.isNsfw,
    },
    character.createdBy?.name || undefined
  )

  const filename = `${character.slug || character.name.toLowerCase().replace(/\s+/g, "-")}.json`

  return new NextResponse(JSON.stringify(card, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
