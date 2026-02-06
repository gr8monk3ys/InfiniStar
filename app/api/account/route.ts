import { NextResponse, type NextRequest } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"

import { verifyCsrfToken } from "@/app/lib/csrf"
import { sendAccountDeletionPendingEmail } from "@/app/lib/email"
import prisma from "@/app/lib/prismadb"
import { accountDeletionLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"

// Grace period in days before permanent deletion
const DELETION_GRACE_PERIOD_DAYS = 30

// Validation schema for account deletion request
const deleteAccountSchema = z.object({
  password: z.string().optional(), // Required for credential users
  confirmationText: z.string().refine((val) => val === "DELETE", {
    message: 'You must type "DELETE" to confirm',
  }),
})

/**
 * Helper function to validate CSRF token
 */
function validateCsrf(request: NextRequest): boolean {
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

  return verifyCsrfToken(headerToken, cookieToken)
}

/**
 * DELETE /api/account - Request account deletion
 *
 * GDPR-compliant account deletion with 30-day grace period.
 * User can cancel during grace period.
 */
export async function DELETE(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = getClientIdentifier(request)
    const allowed = await Promise.resolve(accountDeletionLimiter.check(identifier))
    if (!allowed) {
      return NextResponse.json(
        {
          error: "Too many deletion requests. Please try again later.",
          code: "RATE_LIMITED",
        },
        { status: 429 }
      )
    }

    // CSRF Protection
    if (!validateCsrf(request)) {
      return NextResponse.json(
        { error: "Invalid CSRF token", code: "CSRF_INVALID" },
        { status: 403 }
      )
    }

    const currentUser = await getCurrentUser()

    if (!currentUser?.id || !currentUser?.email) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 })
    }

    // Check if deletion is already pending
    if (currentUser.deletionRequested) {
      return NextResponse.json(
        {
          error: "Account deletion is already pending",
          code: "DELETION_ALREADY_PENDING",
          deletionScheduledFor: currentUser.deletionScheduledFor,
        },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validation = deleteAccountSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    const { password } = validation.data

    // Get user with hashed password to check if credential user
    const userWithPassword = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { hashedPassword: true },
    })

    // If user has a password (credential account), verify it
    if (userWithPassword?.hashedPassword) {
      if (!password) {
        return NextResponse.json(
          { error: "Password is required to delete your account", code: "PASSWORD_REQUIRED" },
          { status: 400 }
        )
      }

      const isCorrectPassword = await bcrypt.compare(password, userWithPassword.hashedPassword)

      if (!isCorrectPassword) {
        return NextResponse.json(
          { error: "Incorrect password", code: "PASSWORD_INCORRECT" },
          { status: 400 }
        )
      }
    }

    // Calculate deletion date (30 days from now)
    const deletionScheduledFor = new Date()
    deletionScheduledFor.setDate(deletionScheduledFor.getDate() + DELETION_GRACE_PERIOD_DAYS)

    // Mark account for deletion
    const updatedUser = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        deletionRequested: true,
        deletionRequestedAt: new Date(),
        deletionScheduledFor,
        deletionCancelledAt: null, // Clear any previous cancellation
      },
      select: {
        id: true,
        email: true,
        name: true,
        deletionScheduledFor: true,
      },
    })

    // Send notification email
    if (updatedUser.email && updatedUser.deletionScheduledFor) {
      await sendAccountDeletionPendingEmail(
        updatedUser.email,
        updatedUser.name || "User",
        updatedUser.deletionScheduledFor
      )
    }

    // Log the deletion request for audit purposes
    // eslint-disable-next-line no-console -- Audit logging for GDPR compliance
    console.log(
      `[ACCOUNT_DELETION] User ${updatedUser.id} requested account deletion. ` +
        `Scheduled for: ${updatedUser.deletionScheduledFor?.toISOString()}`
    )

    return NextResponse.json({
      success: true,
      message: "Account deletion scheduled",
      deletionScheduledFor: updatedUser.deletionScheduledFor,
      gracePeriodDays: DELETION_GRACE_PERIOD_DAYS,
    })
  } catch (error: unknown) {
    console.error("ACCOUNT_DELETION_ERROR", error)
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
