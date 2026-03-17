import { NextResponse, type NextRequest } from "next/server"

import { CardParseError, extractJsonFromPng, fromCharaCard } from "@/app/lib/character-card-v2"
import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import {
  buildModerationDetails,
  moderateTextModelAssisted,
  moderationReasonFromCategories,
} from "@/app/lib/moderation"
import { canAccessNsfw } from "@/app/lib/nsfw"
import prisma from "@/app/lib/prismadb"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import { sanitizePlainText, sanitizeUrl } from "@/app/lib/sanitize"
import { slugify } from "@/app/lib/slug"
import getCurrentUser from "@/app/actions/getCurrentUser"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB (PNG cards with embedded art)

/**
 * POST /api/characters/import
 *
 * Import a character from a V2/V1 character card.
 * Accepts:
 *   - application/json: V2 or V1 character card JSON
 *   - multipart/form-data: PNG file with embedded character data,
 *     or JSON file upload
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // CSRF
  const headerToken = request.headers.get("X-CSRF-Token")
  const cookieToken = getCsrfTokenFromRequest(request)
  if (!verifyCsrfToken(headerToken, cookieToken)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  try {
    const cardJson = await extractCardFromRequest(request)
    const { character, warnings } = fromCharaCard(cardJson)

    // Sanitize all text fields
    const sanitizedName = sanitizePlainText(character.name)
    if (!sanitizedName || sanitizedName.length < 3) {
      return NextResponse.json(
        { error: "Character name must be at least 3 characters after sanitization." },
        { status: 400 }
      )
    }

    // NSFW check
    if (character.isNsfw && !canAccessNsfw(currentUser)) {
      return NextResponse.json(
        { error: "You must confirm you are 18+ to import NSFW characters." },
        { status: 403 }
      )
    }

    // Content moderation
    const moderationPayload = [
      sanitizedName,
      character.tagline ? sanitizePlainText(character.tagline) : "",
      character.description ? sanitizePlainText(character.description) : "",
      character.greeting ? sanitizePlainText(character.greeting) : "",
      character.scenario ? sanitizePlainText(character.scenario) : "",
      character.exampleDialogues ? sanitizePlainText(character.exampleDialogues) : "",
      character.systemPrompt,
    ]
      .filter(Boolean)
      .join("\n")

    const moderationResult = await moderateTextModelAssisted(moderationPayload)
    if (moderationResult.shouldBlock) {
      return NextResponse.json(
        {
          error: "Imported character content was blocked by safety filters.",
          code: "CONTENT_BLOCKED",
          categories: moderationResult.categories,
        },
        { status: 400 }
      )
    }

    // Generate unique slug
    const baseSlug = slugify(sanitizedName)
    let slug = baseSlug
    let suffix = 1
    while (await prisma.character.findUnique({ where: { slug } })) {
      suffix += 1
      slug = `${baseSlug}-${suffix}`
    }

    // Sanitize URLs
    const avatarUrl = character.avatarUrl ? sanitizeUrl(character.avatarUrl) : null
    const coverImageUrl = character.coverImageUrl ? sanitizeUrl(character.coverImageUrl) : null

    // Create the character
    const created = await prisma.character.create({
      data: {
        name: sanitizedName,
        slug,
        tagline: character.tagline ? sanitizePlainText(character.tagline) : null,
        description: character.description ? sanitizePlainText(character.description) : null,
        greeting: character.greeting ? sanitizePlainText(character.greeting) : null,
        scenario: character.scenario ? sanitizePlainText(character.scenario) : null,
        exampleDialogues: character.exampleDialogues
          ? sanitizePlainText(character.exampleDialogues)
          : null,
        systemPrompt: character.systemPrompt,
        avatarUrl,
        coverImageUrl,
        tags: character.tags.map((tag) => sanitizePlainText(tag)).filter((t): t is string => !!t),
        category: sanitizePlainText(character.category) || "general",
        isPublic: false, // Imported characters always start as private
        isNsfw: character.isNsfw,
        createdById: currentUser.id,
      },
    })

    // Flag for review if needed
    if (moderationResult.shouldReview) {
      await prisma.contentReport.create({
        data: {
          reporterId: currentUser.id,
          targetType: "CHARACTER",
          targetId: created.id,
          reason: moderationReasonFromCategories(moderationResult.categories),
          details: buildModerationDetails(moderationResult, "character-import"),
          status: "OPEN",
        },
      })
    }

    return NextResponse.json(
      {
        character: created,
        warnings,
        message: `Character "${created.name}" imported successfully.`,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof CardParseError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    throw error
  }
}

// ---------------------------------------------------------------------------
// Request parsing
// ---------------------------------------------------------------------------

async function extractCardFromRequest(request: NextRequest): Promise<unknown> {
  const contentType = request.headers.get("content-type") || ""

  // Direct JSON body
  if (contentType.includes("application/json")) {
    return request.json()
  }

  // File upload (multipart/form-data)
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      throw new CardParseError("No file uploaded. Expected a JSON or PNG file.")
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new CardParseError("File too large. Maximum size is 10 MB.")
    }

    const filename = file.name.toLowerCase()

    // JSON file
    if (filename.endsWith(".json")) {
      const text = await file.text()
      return JSON.parse(text)
    }

    // PNG file — extract embedded character data
    if (filename.endsWith(".png")) {
      const buffer = await file.arrayBuffer()
      return extractJsonFromPng(buffer)
    }

    throw new CardParseError("Unsupported file type. Upload a .json or .png character card file.")
  }

  throw new CardParseError(
    "Unsupported content type. Send JSON body or multipart/form-data with a file."
  )
}
