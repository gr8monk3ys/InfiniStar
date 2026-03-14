import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import { apiLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import { sanitizePlainText } from "@/app/lib/sanitize"
import getCurrentUser from "@/app/actions/getCurrentUser"

const createPersonaSchema = z.object({
  name: z.string().min(1, "Name is required").max(60),
  description: z.string().max(1000).optional(),
  appearance: z.string().max(1000).optional(),
  personalityTraits: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
})

const MAX_PERSONAS = 20

export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const personas = await prisma.userPersona.findMany({
      where: { userId: currentUser.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    })

    return NextResponse.json(personas)
  } catch (error) {
    apiLogger.error({ err: error }, "Error fetching personas")
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const identifier = getClientIdentifier(request)
  if (!apiLimiter.check(identifier)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const headerToken = request.headers.get("X-CSRF-Token")
  const cookieToken = getCsrfTokenFromRequest(request)
  if (!verifyCsrfToken(headerToken, cookieToken)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validation = createPersonaSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
    }

    const data = validation.data

    const count = await prisma.userPersona.count({ where: { userId: currentUser.id } })
    if (count >= MAX_PERSONAS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_PERSONAS} personas allowed` },
        { status: 400 }
      )
    }

    // If setting as default, unset any existing default
    if (data.isDefault) {
      await prisma.userPersona.updateMany({
        where: { userId: currentUser.id, isDefault: true },
        data: { isDefault: false },
      })
    }

    const persona = await prisma.userPersona.create({
      data: {
        name: sanitizePlainText(data.name) || data.name,
        description: data.description ? sanitizePlainText(data.description) : null,
        appearance: data.appearance ? sanitizePlainText(data.appearance) : null,
        personalityTraits: data.personalityTraits
          ? sanitizePlainText(data.personalityTraits)
          : null,
        isDefault: data.isDefault ?? false,
        userId: currentUser.id,
      },
    })

    return NextResponse.json(persona, { status: 201 })
  } catch (error) {
    apiLogger.error({ err: error }, "Error creating persona")
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
