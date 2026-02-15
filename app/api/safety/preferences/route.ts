import { NextResponse } from "next/server"
import { z } from "zod"

import { withCsrfProtection } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import getCurrentUser from "@/app/actions/getCurrentUser"

const updateSchema = z.object({
  isAdult: z.boolean().optional(),
  nsfwEnabled: z.boolean().optional(),
})

export async function GET() {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prefs = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        isAdult: true,
        adultConfirmedAt: true,
        nsfwEnabled: true,
        nsfwEnabledAt: true,
      },
    })

    if (!prefs) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({
      preferences: {
        isAdult: prefs.isAdult,
        adultConfirmedAt: prefs.adultConfirmedAt,
        nsfwEnabled: prefs.nsfwEnabled,
        nsfwEnabledAt: prefs.nsfwEnabledAt,
      },
    })
  } catch (error: unknown) {
    console.error("SAFETY_PREFERENCES_GET_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export const PATCH = withCsrfProtection(async (request: Request) => {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const existing = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        isAdult: true,
        adultConfirmedAt: true,
        nsfwEnabled: true,
        nsfwEnabledAt: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const requestedIsAdult = parsed.data.isAdult
    const requestedNsfwEnabled = parsed.data.nsfwEnabled

    if (requestedIsAdult === false && requestedNsfwEnabled === true) {
      return NextResponse.json(
        { error: "You must confirm you are 18+ to enable NSFW content." },
        { status: 400 }
      )
    }

    const nextIsAdult = requestedIsAdult ?? existing.isAdult
    const nextNsfwEnabled =
      requestedIsAdult === false ? false : (requestedNsfwEnabled ?? existing.nsfwEnabled)

    if (nextNsfwEnabled && !nextIsAdult) {
      return NextResponse.json(
        { error: "You must confirm you are 18+ to enable NSFW content." },
        { status: 400 }
      )
    }

    const now = new Date()
    const updateData: {
      isAdult?: boolean
      adultConfirmedAt?: Date | null
      nsfwEnabled?: boolean
      nsfwEnabledAt?: Date | null
    } = {}

    if (parsed.data.isAdult !== undefined) {
      updateData.isAdult = parsed.data.isAdult
      if (parsed.data.isAdult && !existing.adultConfirmedAt) {
        updateData.adultConfirmedAt = now
      }
      if (!parsed.data.isAdult) {
        updateData.nsfwEnabled = false
        updateData.nsfwEnabledAt = null
      }
    }

    if (requestedNsfwEnabled !== undefined && requestedIsAdult !== false) {
      updateData.nsfwEnabled = requestedNsfwEnabled
      if (requestedNsfwEnabled && !existing.nsfwEnabledAt) {
        updateData.nsfwEnabledAt = now
      }
      if (!requestedNsfwEnabled) {
        updateData.nsfwEnabledAt = null
      }
    }

    const updated = await prisma.user.update({
      where: { id: currentUser.id },
      data: updateData,
      select: {
        isAdult: true,
        adultConfirmedAt: true,
        nsfwEnabled: true,
        nsfwEnabledAt: true,
      },
    })

    return NextResponse.json({
      message: "Safety preferences updated successfully",
      preferences: updated,
    })
  } catch (error: unknown) {
    console.error("SAFETY_PREFERENCES_UPDATE_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})
