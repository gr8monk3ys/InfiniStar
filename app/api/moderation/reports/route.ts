import { NextResponse } from "next/server"
import { z } from "zod"

import { guard } from "@/app/lib/guarded-route"
import prisma from "@/app/lib/prismadb"
import { apiLimiter } from "@/app/lib/rate-limit"
import { sanitizePlainText } from "@/app/lib/sanitize"

const reportSchema = z.object({
  targetType: z.enum(["USER", "MESSAGE", "CONVERSATION", "CHARACTER"]),
  targetId: z.string().min(1),
  reason: z.enum(["HARASSMENT", "HATE", "SEXUAL", "VIOLENCE", "SPAM", "COPYRIGHT", "OTHER"]),
  details: z.string().max(2000).optional(),
})

const reportQuerySchema = z.object({
  status: z.enum(["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"]).optional(),
  targetType: z.enum(["USER", "MESSAGE", "CONVERSATION", "CHARACTER"]).optional(),
  limit: z
    .string()
    .transform((value) => Number(value))
    .pipe(z.number().int().positive().max(200))
    .optional(),
})

const reportUpdateSchema = z.object({
  reportId: z.string().uuid("Report ID must be a valid UUID"),
  status: z.enum(["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"]),
  resolutionNote: z.string().max(1000).optional(),
})

function parseReviewerEmails(envValue: string | undefined): string[] {
  if (!envValue) {
    return []
  }

  return envValue
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0)
}

function canUserReviewAllReports(email: string | null | undefined): boolean {
  if (!email) {
    return false
  }
  const reviewerEmails = parseReviewerEmails(process.env.MODERATION_REVIEWER_EMAILS)
  return reviewerEmails.includes(email.toLowerCase())
}

export const GET = guard({ limiter: apiLimiter }, async ({ user, request }) => {
  const { searchParams } = new URL(request.url)
  const queryValidation = reportQuerySchema.safeParse(Object.fromEntries(searchParams.entries()))
  if (!queryValidation.success) {
    return NextResponse.json({ error: queryValidation.error.issues[0].message }, { status: 400 })
  }

  const canReviewAll = canUserReviewAllReports(user.email)

  const { status, targetType, limit } = queryValidation.data

  const reports = await prisma.contentReport.findMany({
    where: {
      ...(canReviewAll ? {} : { reporterId: user.id }),
      ...(status ? { status } : {}),
      ...(targetType ? { targetType } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit || 100,
    include: {
      reporter: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  return NextResponse.json({ reports, canReviewAll })
})

export const POST = guard({ limiter: apiLimiter, body: reportSchema }, async ({ user, body }) => {
  const report = await prisma.contentReport.create({
    data: {
      reporterId: user.id,
      targetType: body.targetType,
      targetId: body.targetId,
      reason: body.reason,
      details: body.details,
    },
  })

  return NextResponse.json({ report }, { status: 201 })
})

export const PATCH = guard(
  { limiter: apiLimiter, body: reportUpdateSchema },
  async ({ user, body }) => {
    if (!canUserReviewAllReports(user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { reportId, status, resolutionNote } = body
    const existingReport = await prisma.contentReport.findUnique({
      where: { id: reportId },
    })
    if (!existingReport) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    const sanitizedNote = resolutionNote ? sanitizePlainText(resolutionNote) : null
    const nextDetails = sanitizedNote
      ? `${existingReport.details ? `${existingReport.details}\n\n` : ""}Reviewer note: ${sanitizedNote}`
      : existingReport.details

    const shouldSetResolvedState = status === "RESOLVED" || status === "DISMISSED"
    const report = await prisma.contentReport.update({
      where: { id: reportId },
      data: {
        status,
        details: nextDetails || null,
        resolvedAt: shouldSetResolvedState ? new Date() : null,
        resolvedBy: shouldSetResolvedState ? user.id : null,
      },
    })

    return NextResponse.json({ report })
  }
)
