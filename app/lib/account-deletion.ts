/**
 * Account Deletion Utilities
 *
 * GDPR-compliant account deletion with data anonymization.
 *
 * This module handles the actual deletion of user accounts after the grace period.
 * It should be called by a background job (cron) or manual process.
 *
 * Background Job Setup (example with Vercel Cron):
 *
 * 1. Create a cron job endpoint in app/api/cron/process-deletions/route.ts
 * 2. Configure vercel.json to run it daily:
 *    {
 *      "crons": [{
 *        "path": "/api/cron/process-deletions",
 *        "schedule": "0 2 * * *"  // Run at 2 AM daily
 *      }]
 *    }
 * 3. Protect the endpoint with a secret key check
 */

import { sendAccountDeletedEmail } from "@/app/lib/email"
import prisma from "@/app/lib/prismadb"

// Anonymized values for deleted content
const DELETED_MESSAGE_BODY = "[Deleted]"
// Note: If you want to replace user names in the UI, add a deleted user label here.

/**
 * Process all accounts scheduled for deletion
 *
 * This function should be called by a background job (cron) to process
 * accounts whose grace period has expired.
 *
 * @returns Object with counts of processed accounts
 */
export async function processScheduledDeletions(): Promise<{
  processed: number
  failed: number
  errors: string[]
}> {
  const now = new Date()
  const errors: string[] = []
  let processed = 0
  let failed = 0

  // Find all accounts scheduled for deletion where grace period has expired
  const usersToDelete = await prisma.user.findMany({
    where: {
      deletionRequested: true,
      deletionScheduledFor: {
        lte: now,
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  })

  for (const user of usersToDelete) {
    // Capture email and name before deletion — the user record will no longer
    // exist after deleteUserAccount() completes, so we must read these fields now.
    const userEmail = user.email
    const userName = user.name

    try {
      await deleteUserAccount(user.id)
      processed++
      console.warn(`[ACCOUNT_DELETION] Successfully deleted user ${user.id}`)
    } catch (error) {
      failed++
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      errors.push(`Failed to delete user ${user.id}: ${errorMessage}`)
      console.error(`[ACCOUNT_DELETION] Failed to delete user ${user.id}:`, error)
      // Skip the confirmation email — the user was not deleted.
      continue
    }

    // Send confirmation email as a best-effort step.  A failed email does NOT
    // mean the deletion failed — the account has already been removed.
    if (userEmail) {
      try {
        await sendAccountDeletedEmail(userEmail, userName || "User")
      } catch (emailError) {
        console.error(`[ACCOUNT_DELETION] Confirmation email failed for ${userEmail}:`, emailError)
        // Do NOT increment `failed` — the deletion itself succeeded.
      }
    }
  }

  return { processed, failed, errors }
}

/**
 * Delete a user account and all associated data
 *
 * This performs the following operations:
 * 1. Anonymize all messages sent by the user
 * 2. Remove user from all conversations
 * 3. Remove user from "seen" relationship on all messages
 * 4. Delete AI usage records
 * 5. Delete the user record
 *
 * @param userId The ID of the user to delete
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  // Use a transaction to ensure all operations succeed or fail together
  await prisma.$transaction(async (tx) => {
    // 1. Anonymize all messages sent by this user
    // We set the body to "[Deleted]" to preserve conversation structure
    // while removing personal content
    await tx.message.updateMany({
      where: { senderId: userId },
      data: {
        body: DELETED_MESSAGE_BODY,
        image: null,
        isDeleted: true,
        deletedAt: new Date(),
      },
    })

    // 2. Remove user from "seen" relationship on all messages
    // Delete all rows from the implicit join table in one query instead of
    // fetching each message and disconnecting one by one (avoids N+1).
    // Prisma names the join table after the relation: "_Seen".
    // Column "A" = messageId (Message, alphabetically first), "B" = userId (User).
    await tx.$executeRaw`DELETE FROM "_Seen" WHERE "B" = ${userId}::uuid`

    // 3. Remove user from all conversations
    const userConversations = await tx.conversation.findMany({
      where: {
        users: {
          some: {
            id: userId,
          },
        },
      },
      select: { id: true },
    })

    for (const conversation of userConversations) {
      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          users: {
            disconnect: { id: userId },
          },
        },
      })
    }

    // 4. Delete AI usage records
    await tx.aiUsage.deleteMany({
      where: { userId },
    })

    // 5. Remove user from conversation array columns (archivedBy, pinnedBy, mutedBy)
    // Leaving the userId in these arrays would create ghost entries that can never
    // be cleaned up since the user record no longer exists after deletion.
    await tx.$executeRaw`
      UPDATE "conversations"
      SET "archivedBy" = array_remove("archivedBy", ${userId}),
          "pinnedBy" = array_remove("pinnedBy", ${userId}),
          "mutedBy" = array_remove("mutedBy", ${userId})
      WHERE "archivedBy" @> ARRAY[${userId}]::text[]
         OR "pinnedBy" @> ARRAY[${userId}]::text[]
         OR "mutedBy" @> ARRAY[${userId}]::text[]
    `

    // 6. Finally, delete the user record
    await tx.user.delete({
      where: { id: userId },
    })
  })
}

/**
 * Get statistics about pending deletions
 *
 * @returns Object with deletion statistics
 */
export async function getDeletionStats(): Promise<{
  pendingDeletions: number
  overdueForDeletion: number
  cancelledDeletions: number
}> {
  const now = new Date()

  const [pendingDeletions, overdueForDeletion, cancelledDeletions] = await Promise.all([
    prisma.user.count({
      where: {
        deletionRequested: true,
        deletionScheduledFor: {
          gt: now,
        },
      },
    }),
    prisma.user.count({
      where: {
        deletionRequested: true,
        deletionScheduledFor: {
          lte: now,
        },
      },
    }),
    prisma.user.count({
      where: {
        deletionRequested: false,
        deletionCancelledAt: {
          not: null,
        },
      },
    }),
  ])

  return {
    pendingDeletions,
    overdueForDeletion,
    cancelledDeletions,
  }
}

/**
 * Check if a user account is marked for deletion
 *
 * @param userId The ID of the user to check
 * @returns Object with deletion status information
 */
export async function checkUserDeletionStatus(userId: string): Promise<{
  isScheduledForDeletion: boolean
  deletionScheduledFor: Date | null
  daysRemaining: number | null
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      deletionRequested: true,
      deletionScheduledFor: true,
    },
  })

  if (!user || !user.deletionRequested || !user.deletionScheduledFor) {
    return {
      isScheduledForDeletion: false,
      deletionScheduledFor: null,
      daysRemaining: null,
    }
  }

  const now = new Date()
  const diffTime = user.deletionScheduledFor.getTime() - now.getTime()
  const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))

  return {
    isScheduledForDeletion: true,
    deletionScheduledFor: user.deletionScheduledFor,
    daysRemaining,
  }
}
