import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { verifyCsrfToken } from "@/app/lib/csrf"
import { moderateTextModelAssisted } from "@/app/lib/moderation"
import { aiChatLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import { sanitizeMessage, sanitizeUrl } from "@/app/lib/sanitize"
import getCurrentUser from "@/app/actions/getCurrentUser"

const transcribeSchema = z.object({
  audioUrl: z.string().url("Invalid audio URL").max(2000, "Audio URL too long"),
  language: z.string().max(16).optional().nullable(),
})

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

    const openAiKey = process.env.OPENAI_API_KEY
    if (!openAiKey) {
      return NextResponse.json({ error: "Transcription is not configured." }, { status: 501 })
    }

    const body = await request.json()
    const validation = transcribeSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
    }

    const sanitizedAudioUrl = sanitizeUrl(validation.data.audioUrl)
    if (!sanitizedAudioUrl) {
      return NextResponse.json({ error: "Invalid audio URL" }, { status: 400 })
    }

    const audioRes = await fetch(sanitizedAudioUrl)
    if (!audioRes.ok) {
      return NextResponse.json({ error: "Failed to fetch audio." }, { status: 400 })
    }

    const contentType = audioRes.headers.get("content-type") || "audio/webm"
    const buffer = await audioRes.arrayBuffer()
    const audioBlob = new Blob([buffer], { type: contentType })

    const model = process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1"
    const form = new FormData()
    form.append("model", model)
    form.append("file", audioBlob, "voice-message.webm")
    if (validation.data.language) {
      form.append("language", validation.data.language)
    }

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
