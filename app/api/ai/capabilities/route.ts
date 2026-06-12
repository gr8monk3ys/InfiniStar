import { NextResponse, type NextRequest } from "next/server"

import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"

/**
 * GET /api/ai/capabilities
 *
 * Public, unauthenticated endpoint that reports which optional AI media
 * features are configured on this deployment so the client can hide UI for
 * features that would otherwise fail with 501 errors.
 *
 * - Image generation (`/api/ai/image/generate`) requires OPENAI_API_KEY plus
 *   Cloudinary storage (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and
 *   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET).
 * - Voice transcription (`/api/ai/transcribe`) requires OPENAI_API_KEY and
 *   validates audio URLs against NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME; the client
 *   additionally needs NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET to upload the
 *   recording in the first place.
 *
 * Only booleans are returned — never key values. Responses are cacheable
 * because capabilities only change on redeploy/config change.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const identifier = getClientIdentifier(request)
  const allowed = await Promise.resolve(apiLimiter.check(identifier))
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } }
    )
  }

  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY)
  const hasCloudinaryConfig = Boolean(
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
  )

  return NextResponse.json(
    {
      imageGeneration: hasOpenAiKey && hasCloudinaryConfig,
      voiceTranscription: hasOpenAiKey && hasCloudinaryConfig,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  )
}
