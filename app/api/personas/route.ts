import { NextResponse } from "next/server"
import { z } from "zod"

import { guard } from "@/app/lib/guarded-route"
import prisma from "@/app/lib/prismadb"
import { apiLimiter } from "@/app/lib/rate-limit"
import { sanitizePlainText } from "@/app/lib/sanitize"

const createPersonaSchema = z.object({
  name: z.string().min(1, "Name is required").max(60),
  description: z.string().max(1000).optional(),
  appearance: z.string().max(1000).optional(),
  personalityTraits: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
})

const MAX_PERSONAS = 20

export const GET = guard({ limiter: apiLimiter }, async ({ user }) => {
  const personas = await prisma.userPersona.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  })

  return NextResponse.json(personas)
})

export const POST = guard(
  { limiter: apiLimiter, body: createPersonaSchema },
  async ({ user, body }) => {
    const count = await prisma.userPersona.count({ where: { userId: user.id } })
    if (count >= MAX_PERSONAS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_PERSONAS} personas allowed` },
        { status: 400 }
      )
    }

    // If setting as default, unset any existing default
    if (body.isDefault) {
      await prisma.userPersona.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      })
    }

    const persona = await prisma.userPersona.create({
      data: {
        name: sanitizePlainText(body.name) || body.name,
        description: body.description ? sanitizePlainText(body.description) : null,
        appearance: body.appearance ? sanitizePlainText(body.appearance) : null,
        personalityTraits: body.personalityTraits
          ? sanitizePlainText(body.personalityTraits)
          : null,
        isDefault: body.isDefault ?? false,
        userId: user.id,
      },
    })

    return NextResponse.json(persona, { status: 201 })
  }
)
