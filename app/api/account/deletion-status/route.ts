import { NextResponse, type NextRequest } from "next/server"

import prisma from "@/app/lib/prismadb"
import getCurrentUser from "@/app/actions/getCurrentUser"

/**
 * GET /api/account/deletion-status - Get account deletion status
 *
 * Returns information about pending account deletion, including:
 * - Whether deletion is requested
 * - When deletion was requested
 * - When deletion is scheduled for
 * - Days remaining in grace period
 */
export async function GET(_request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        deletionRequested: true,
        deletionRequestedAt: true,
        deletionScheduledFor: true,
        deletionCancelledAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found", code: "USER_NOT_FOUND" }, { status: 404 })
    }

    // Calculate days remaining if deletion is pending
    let daysRemaining: number | null = null
    if (user.deletionRequested && user.deletionScheduledFor) {
      const now = new Date()
      const scheduledDate = new Date(user.deletionScheduledFor)
      const diffTime = scheduledDate.getTime() - now.getTime()
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      // Ensure we don't return negative days
      if (daysRemaining < 0) {
        daysRemaining = 0
      }
    }

    return NextResponse.json({
      deletionRequested: user.deletionRequested,
      deletionRequestedAt: user.deletionRequestedAt,
      deletionScheduledFor: user.deletionScheduledFor,
      deletionCancelledAt: user.deletionCancelledAt,
      daysRemaining,
    })
  } catch (error: unknown) {
    console.error("DELETION_STATUS_ERROR", error)
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
