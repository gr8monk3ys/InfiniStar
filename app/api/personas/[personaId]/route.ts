import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import { apiLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import { sanitizePlainText } from "@/app/lib/sanitize"
import getCurrentUser from "@/app/actions/getCurrentUser"

const updatePersonaSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  description: z.string().max(1000).optional().nullable(),
  appearance: z.string().max(1000).optional().nullable(),
  personalityTraits: z.string().max(500).optional().nullable(),
  isDefault: z.boolean().optional(),
})

interface RouteParams {
  params: Promise<{ personaId: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { personaId } = await params
    const persona = await prisma.userPersona.findFirst({
      where: { id: personaId, userId: currentUser.id },
    })

    if (!persona) {
      return NextResponse.json({ error: "Persona not found" }, { status: 404 })
    }

    return NextResponse.json(persona)
  } catch (error) {
    apiLogger.error({ err: error }, "Error fetching persona")
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const { personaId } = await params
    const existing = await prisma.userPersona.findFirst({
      where: { id: personaId, userId: currentUser.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Persona not found" }, { status: 404 })
    }

    const body = await request.json()
    const validation = updatePersonaSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
    }

    const data = validation.data

    if (data.isDefault) {
      await prisma.userPersona.updateMany({
        where: { userId: currentUser.id, isDefault: true, NOT: { id: personaId } },
        data: { isDefault: false },
      })
    }

    const updated = await prisma.userPersona.update({
      where: { id: personaId },
      data: {
        name: data.name ? sanitizePlainText(data.name) || undefined : undefined,
        description: data.description ? sanitizePlainText(data.description) : data.description,
        appearance: data.appearance ? sanitizePlainText(data.appearance) : data.appearance,
        personalityTraits: data.personalityTraits
          ? sanitizePlainText(data.personalityTraits)
          : data.personalityTraits,
        isDefault: data.isDefault,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    apiLogger.error({ err: error }, "Error updating persona")
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const { personaId } = await params
    const existing = await prisma.userPersona.findFirst({
      where: { id: personaId, userId: currentUser.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Persona not found" }, { status: 404 })
    }

    await prisma.userPersona.delete({ where: { id: personaId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error({ err: error }, "Error deleting persona")
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
