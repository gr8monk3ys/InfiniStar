import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { getAiAccessDecision } from "@/app/lib/ai-access"
import { AI_TRANSCRIBE_COST_CENTS_PER_REQUEST } from "@/app/lib/ai-limits"
import { trackAiUsage } from "@/app/lib/ai-usage"
import { verifyCsrfToken } from "@/app/lib/csrf"
import { moderateTextModelAssisted } from "@/app/lib/moderation"
import { canAccessNsfw } from "@/app/lib/nsfw"
import prisma from "@/app/lib/prismadb"
import { aiChatLimiter, aiTranscribeLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import { sanitizeMessage, sanitizeUrl } from "@/app/lib/sanitize"
import getCurrentUser from "@/app/actions/getCurrentUser"

const transcribeSchema = z.object({
  conversationId: z.string().uuid(),
  audioUrl: z.string().url("Invalid audio URL").max(2000, "Audio URL too long"),
  language: z.string().max(16).optional().nullable(),
})

const MAX_AUDIO_BYTES = 25 * 1024 * 1024 // 25MB

function isAllowedCloudinaryAudioUrl(audioUrl: string): boolean {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  if (!cloudName) return false

  try {
    const parsed = new URL(audioUrl)
    if (parsed.protocol !== "https:") return false
    if (parsed.hostname !== "res.cloudinary.com") return false

    // Expect URLs like: https://res.cloudinary.com/<cloudName>/video/upload/...
    if (!parsed.pathname.startsWith(`/${cloudName}/`)) return false
    if (!parsed.pathname.includes("/video/upload/") && !parsed.pathname.includes("/raw/upload/")) {
      return false
    }

    return true
  } catch {
    return false
  }
}

async function readArrayBufferWithLimit(
  response: Response,
  maxBytes: number
): Promise<ArrayBuffer> {
  const contentLengthHeader = response.headers.get("content-length")
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader)
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new Error("PAYLOAD_TOO_LARGE")
    }
  }

  const body = response.body
  if (!body) {
    const buffer = await response.arrayBuffer()
    if (buffer.byteLength > maxBytes) {
      throw new Error("PAYLOAD_TOO_LARGE")
    }
    return buffer
  }

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue

      received += value.byteLength
      if (received > maxBytes) {
        throw new Error("PAYLOAD_TOO_LARGE")
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const out = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }

  return out.buffer
}

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

export async function POST(request: NextRequest) {
  const { headerToken, cookieToken } = getCsrfTokens(request)
  if (!verifyCsrfToken(headerToken, cookieToken)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  const identifier = getClientIdentifier(request)
  const allowed = await Promise.resolve(aiChatLimiter.check(identifier))
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many AI requests. Please try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } }
    )
  }

  try {
    const currentUser = await getCurrentUser()
    if (!currentUser?.id || !currentUser.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const transcribeAllowed = await Promise.resolve(aiTranscribeLimiter.check(currentUser.id))
    if (!transcribeAllowed) {
      return NextResponse.json(
        { error: "Too many transcription requests. Please try again in a minute." },
        { status: 429, headers: { "Retry-After": "60" } }
      )
    }

    const accessDecision = await getAiAccessDecision(currentUser.id, { requestType: "transcribe" })
    if (!accessDecision.allowed) {
      return NextResponse.json(
        {
          error:
            accessDecision.message ??
            "AI access is unavailable for this account right now. Please try again.",
          code: accessDecision.code,
          limits: accessDecision.limits,
        },
        { status: 402 }
      )
    }

    const openAiKey = process.env.OPENAI_API_KEY
    if (!openAiKey) {
      return NextResponse.json({ error: "Transcription is not configured." }, { status: 501 })
    }

    const body = await request.json()
    const validation = transcribeSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
    }

    const allowNsfw = canAccessNsfw(currentUser)
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: validation.data.conversationId,
        users: { some: { id: currentUser.id } },
      },
      select: {
        id: true,
        isAI: true,
        character: { select: { isNsfw: true } },
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: "Not authorized for this conversation" }, { status: 403 })
    }

    if (conversation.isAI && conversation.character?.isNsfw && !allowNsfw) {
      return NextResponse.json({ error: "NSFW content is not enabled." }, { status: 403 })
    }

    const proCostCapCents = accessDecision.limits?.monthlyCostQuotaCents ?? null
    const proCostUsageCents = accessDecision.limits?.monthlyCostUsageCents ?? 0
    if (accessDecision.limits?.isPro && proCostCapCents !== null) {
      if (proCostUsageCents + AI_TRANSCRIBE_COST_CENTS_PER_REQUEST > proCostCapCents) {
        return NextResponse.json(
          {
            error:
              accessDecision.message ??
              "You have reached this month's AI fair-use cap. Please contact support to increase limits.",
            code: "PRO_TIER_COST_CAP_REACHED",
            limits: accessDecision.limits,
          },
          { status: 402 }
        )
      }
    }

    const sanitizedAudioUrl = sanitizeUrl(validation.data.audioUrl)
    if (!sanitizedAudioUrl) {
      return NextResponse.json({ error: "Invalid audio URL" }, { status: 400 })
    }

    // Prevent SSRF by restricting to our upload host.
    if (!isAllowedCloudinaryAudioUrl(sanitizedAudioUrl)) {
      return NextResponse.json({ error: "Unsupported audio URL host." }, { status: 400 })
    }

    const audioRes = await fetch(sanitizedAudioUrl, {
      redirect: "error",
      cache: "no-store",
    })
    if (!audioRes.ok) {
      return NextResponse.json({ error: "Failed to fetch audio." }, { status: 400 })
    }

    const contentType = audioRes.headers.get("content-type") || "application/octet-stream"
    const isLikelyMedia =
      contentType.startsWith("audio/") ||
      contentType.startsWith("video/") ||
      contentType === "application/octet-stream"
    if (!isLikelyMedia) {
      return NextResponse.json({ error: "Unsupported audio content type." }, { status: 400 })
    }

    let buffer: ArrayBuffer
    try {
      buffer = await readArrayBufferWithLimit(audioRes, MAX_AUDIO_BYTES)
    } catch (error) {
      if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") {
        return NextResponse.json({ error: "Audio file is too large." }, { status: 413 })
      }
      throw error
    }
    const audioBlob = new Blob([buffer], { type: contentType })

    const model = process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1"
    const form = new FormData()
    form.append("model", model)
    form.append("file", audioBlob, "voice-message.webm")
    if (validation.data.language) {
      form.append("language", validation.data.language)
    }

    const startTime = Date.now()
    const transcriptionRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
      },
      body: form,
    })

    if (!transcriptionRes.ok) {
      return NextResponse.json({ error: "Failed to transcribe audio." }, { status: 502 })
    }

    const latencyMs = Date.now() - startTime
    await trackAiUsage({
      userId: currentUser.id,
      conversationId: conversation.id,
      model: `openai:${model}`,
      inputTokens: 0,
      outputTokens: 0,
      requestType: "transcribe",
      latencyMs,
      costOverrideCents: AI_TRANSCRIBE_COST_CENTS_PER_REQUEST,
    })

    const transcriptionJson = (await transcriptionRes.json()) as unknown
    const rawText = (transcriptionJson as { text?: string }).text ?? ""
    const transcript = rawText ? sanitizeMessage(rawText) : ""

    if (!transcript.trim()) {
      return NextResponse.json({ transcript: "" })
    }

    const moderationResult = await moderateTextModelAssisted(transcript)
    if (moderationResult.shouldBlock) {
      return NextResponse.json(
        {
          error: "Transcript was blocked by safety filters.",
          code: "CONTENT_BLOCKED",
          categories: moderationResult.categories,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({ transcript })
  } catch (error) {
    console.error("AI_TRANSCRIBE_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
