import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { getAiAccessDecision } from "@/app/lib/ai-access"
import { verifyCsrfToken } from "@/app/lib/csrf"
import { moderateTextModelAssisted } from "@/app/lib/moderation"
import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import { getPusherConversationChannel, getPusherUserChannel } from "@/app/lib/pusher-channels"
import { aiChatLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import { sanitizePlainText } from "@/app/lib/sanitize"
import getCurrentUser from "@/app/actions/getCurrentUser"

const generateImageSchema = z.object({
  conversationId: z.string().uuid(),
  prompt: z.string().min(3, "Prompt is required").max(2000, "Prompt too long (max 2000 chars)"),
  size: z.enum(["512x512", "1024x1024", "1024x1792", "1792x1024"]).optional(),
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

    const body = await request.json()
    const validation = generateImageSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
    }

    const sanitizedPrompt = sanitizePlainText(validation.data.prompt)
    if (!sanitizedPrompt) {
      return NextResponse.json({ error: "Invalid prompt" }, { status: 400 })
    }

    const moderationResult = await moderateTextModelAssisted(sanitizedPrompt)
    if (moderationResult.shouldBlock) {
      return NextResponse.json(
        {
          error: "Prompt was blocked by safety filters.",
          code: "CONTENT_BLOCKED",
          categories: moderationResult.categories,
        },
        { status: 400 }
      )
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: validation.data.conversationId,
        users: { some: { id: currentUser.id } },
      },
      select: { id: true, isAI: true },
    })

    if (!conversation) {
      return NextResponse.json({ error: "Not authorized for this conversation" }, { status: 403 })
    }

    if (!conversation.isAI) {
      return NextResponse.json({ error: "Not an AI conversation" }, { status: 400 })
    }

    const accessDecision = await getAiAccessDecision(currentUser.id)
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
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "pgc9ehd5"

    if (!openAiKey) {
      return NextResponse.json({ error: "Image generation is not configured." }, { status: 501 })
    }
    if (!cloudName) {
      return NextResponse.json({ error: "Cloudinary is not configured." }, { status: 501 })
    }

    const openAiModel = process.env.OPENAI_IMAGE_MODEL || "dall-e-3"
    const size = validation.data.size || "1024x1024"

    const imageRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openAiModel,
        prompt: sanitizedPrompt,
        size,
        n: 1,
      }),
    })

    if (!imageRes.ok) {
      return NextResponse.json({ error: "Failed to generate image." }, { status: 502 })
    }

    const imageJson = (await imageRes.json()) as unknown
    const imageData = (imageJson as { data?: Array<{ url?: string; b64_json?: string }> }).data?.[0]
    const openAiUrl = imageData?.url ?? null
    const openAiB64 = imageData?.b64_json ?? null
    if (!openAiUrl && !openAiB64) {
      return NextResponse.json({ error: "Image generation returned no image." }, { status: 502 })
    }

    const uploadFile = openAiB64 ? `data:image/png;base64,${openAiB64}` : openAiUrl
    if (!uploadFile) {
      return NextResponse.json({ error: "Image generation returned no image." }, { status: 502 })
    }

    const form = new FormData()
    form.set("file", uploadFile)
    form.set("upload_preset", uploadPreset)
    form.set("folder", "infinistar/generated")

    const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: form,
    })

    if (!cloudinaryRes.ok) {
      return NextResponse.json({ error: "Failed to store image." }, { status: 502 })
    }

    const cloudinaryJson = (await cloudinaryRes.json()) as unknown
    const secureUrl =
      (cloudinaryJson as { secure_url?: string; url?: string }).secure_url ??
      (cloudinaryJson as { secure_url?: string; url?: string }).url ??
      null
    if (!secureUrl) {
      return NextResponse.json({ error: "Failed to store image." }, { status: 502 })
    }

    const aiMessage = await prisma.message.create({
      data: {
        body: null,
        image: secureUrl,
        conversationId: conversation.id,
        senderId: currentUser.id,
        seen: { connect: { id: currentUser.id } },
        isAI: true,
      },
      include: { seen: true, sender: true },
    })

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    })

    await pusherServer.trigger(
      getPusherConversationChannel(conversation.id),
      "messages:new",
      aiMessage
    )
    await pusherServer.trigger(getPusherUserChannel(currentUser.id), "conversation:update", {
      id: conversation.id,
      messages: [aiMessage],
    })

    return NextResponse.json({ aiMessage })
  } catch (error) {
    console.error("AI_IMAGE_GENERATE_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
