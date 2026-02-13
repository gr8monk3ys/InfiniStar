import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { z } from "zod"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
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

function getCookieToken(request: NextRequest): string | null {
  const cookieHeader = request.headers.get("cookie")
  if (!cookieHeader) {
    return null
  }

  const cookies = cookieHeader.split(";").reduce(
    (acc, cookie) => {
      const [key, value] = cookie.trim().split("=")
      acc[key] = value
      return acc
    },
    {} as Record<string, string>
  )
  return cookies["csrf-token"] || null
}

function canUserReviewAllReports(email: string | null | undefined): boolean {
  if (!email) {
    return false
  }
  const reviewerEmails = parseReviewerEmails(process.env.MODERATION_REVIEWER_EMAILS)
  return reviewerEmails.includes(email.toLowerCase())
}

async function getCurrentUserForModeration() {
  const { userId } = await auth()
  if (!userId) {
    return null
  }

  return prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, email: true },
  })
}

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUserForModeration()
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const queryValidation = reportQuerySchema.safeParse(Object.fromEntries(searchParams.entries()))
  if (!queryValidation.success) {
    return NextResponse.json({ error: queryValidation.error.issues[0].message }, { status: 400 })
  }

  const canReviewAll = canUserReviewAllReports(currentUser.email)

  const { status, targetType, limit } = queryValidation.data

  const reports = await prisma.contentReport.findMany({
    where: {
      ...(canReviewAll ? {} : { reporterId: currentUser.id }),
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
}

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUserForModeration()
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const headerToken = request.headers.get("X-CSRF-Token")
  const cookieToken = getCookieToken(request)

  if (!verifyCsrfToken(headerToken, cookieToken)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  const body = await request.json()
  const validation = reportSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
  }

  const report = await prisma.contentReport.create({
    data: {
      reporterId: currentUser.id,
      targetType: validation.data.targetType,
      targetId: validation.data.targetId,
      reason: validation.data.reason,
      details: validation.data.details,
    },
  })

  return NextResponse.json({ report }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const currentUser = await getCurrentUserForModeration()
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!canUserReviewAllReports(currentUser.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const headerToken = request.headers.get("X-CSRF-Token")
  const cookieToken = getCookieToken(request)
  if (!verifyCsrfToken(headerToken, cookieToken)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  const body = await request.json()
  const validation = reportUpdateSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
  }

  const { reportId, status, resolutionNote } = validation.data
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
      resolvedBy: shouldSetResolvedState ? currentUser.id : null,
    },
  })

  return NextResponse.json({ report })
}
