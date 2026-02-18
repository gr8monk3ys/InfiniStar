import { NextResponse, type NextRequest } from "next/server"

import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import { sendAccountDeletionCancelledEmail } from "@/app/lib/email"
import prisma from "@/app/lib/prismadb"
import { accountDeletionLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"

/**
 * POST /api/account/cancel-deletion - Cancel pending account deletion
 *
 * Allows user to cancel their account deletion request during the grace period.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = getClientIdentifier(request)
    const allowed = await Promise.resolve(accountDeletionLimiter.check(identifier))
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      )
    }

    // CSRF Protection
    if (!verifyCsrfToken(request.headers.get("X-CSRF-Token"), getCsrfTokenFromRequest(request))) {
      return NextResponse.json(
        { error: "Invalid CSRF token", code: "CSRF_INVALID" },
        { status: 403 }
      )
    }

    const currentUser = await getCurrentUser()

    if (!currentUser?.id || !currentUser?.email) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 })
    }

    // Check if deletion is pending
    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        deletionRequested: true,
        deletionScheduledFor: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found", code: "USER_NOT_FOUND" }, { status: 404 })
    }

    if (!user.deletionRequested) {
      return NextResponse.json(
        { error: "No pending deletion request to cancel", code: "NO_PENDING_DELETION" },
        { status: 400 }
      )
    }

    // Check if grace period has expired
    if (user.deletionScheduledFor && new Date() >= user.deletionScheduledFor) {
      return NextResponse.json(
        {
          error: "Grace period has expired. Account deletion cannot be cancelled.",
          code: "GRACE_PERIOD_EXPIRED",
        },
        { status: 400 }
      )
    }

    // Cancel the deletion
    const updatedUser = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        deletionRequested: false,
        deletionCancelledAt: new Date(),
        // Keep deletionRequestedAt and deletionScheduledFor for audit purposes
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    // Send confirmation email
    if (updatedUser.email) {
      await sendAccountDeletionCancelledEmail(updatedUser.email, updatedUser.name || "User")
    }

    // Log the cancellation for audit purposes
    // eslint-disable-next-line no-console -- Audit logging for GDPR compliance
    console.log(`[ACCOUNT_DELETION] User ${updatedUser.id} cancelled account deletion request.`)

    return NextResponse.json({
      success: true,
      message: "Account deletion cancelled successfully",
    })
  } catch (error: unknown) {
    console.error("CANCEL_DELETION_ERROR", error)
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
