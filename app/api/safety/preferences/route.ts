import { NextResponse } from "next/server"
import { z } from "zod"

import { guard } from "@/app/lib/guarded-route"
import prisma from "@/app/lib/prismadb"
import { apiLimiter } from "@/app/lib/rate-limit"

const updateSchema = z.object({
  isAdult: z.boolean().optional(),
  nsfwEnabled: z.boolean().optional(),
})

const preferenceSelect = {
  isAdult: true,
  adultConfirmedAt: true,
  nsfwEnabled: true,
  nsfwEnabledAt: true,
} as const

/** GET /api/safety/preferences - the current user's adult/NSFW settings. */
export const GET = guard({ limiter: apiLimiter }, async ({ user }) => {
  const prefs = await prisma.user.findUnique({
    where: { id: user.id },
    select: preferenceSelect,
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
})

/**
 * PATCH /api/safety/preferences - update them.
 *
 * The limiter runs through the guard, which derives its identifier with
 * `getClientIdentifier`. This route used to read the LEFT-most
 * `x-forwarded-for` entry by hand — the hop the client itself writes — so any
 * caller could mint a fresh rate-limit bucket per request just by sending the
 * header. `getClientIdentifier` takes the right-most entry instead.
 */
export const PATCH = guard({ limiter: apiLimiter, body: updateSchema }, async ({ user, body }) => {
  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    select: preferenceSelect,
  })

  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const requestedIsAdult = body.isAdult
  const requestedNsfwEnabled = body.nsfwEnabled

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

  if (requestedIsAdult !== undefined) {
    updateData.isAdult = requestedIsAdult
    if (requestedIsAdult && !existing.adultConfirmedAt) {
      updateData.adultConfirmedAt = now
    }
    if (!requestedIsAdult) {
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
    where: { id: user.id },
    data: updateData,
    select: preferenceSelect,
  })

  return NextResponse.json({
    message: "Safety preferences updated successfully",
    preferences: updated,
  })
})
