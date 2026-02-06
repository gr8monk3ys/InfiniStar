/**
 * Conversation Sharing Service
 *
 * Provides functionality for creating, managing, and validating conversation shares.
 * Supports both public link sharing and invite-only sharing.
 */

import crypto from "crypto"
import { SharePermission, ShareType } from "@prisma/client"

import prisma from "@/app/lib/prismadb"

/**
 * Generate a cryptographically secure share token
 * Uses crypto.randomBytes for security
 */
export function generateShareToken(): string {
  return crypto.randomBytes(32).toString("base64url")
}

/**
 * Options for creating a share
 */
export interface CreateShareOptions {
  shareType?: ShareType
  permission?: SharePermission
  expiresAt?: Date | null
  maxUses?: number | null
  allowedEmails?: string[]
  name?: string | null
}

/**
 * Result type for share operations
 */
export interface ShareResult {
  success: boolean
  share?: Awaited<ReturnType<typeof prisma.conversationShare.create>>
  error?: string
}

/**
 * Share info returned for public endpoint
 */
export interface ShareInfo {
  id: string
  conversationId: string
  conversationName: string | null
  messageCount: number
  participantCount: number
  permission: SharePermission
  shareType: ShareType
  isExpired: boolean
  isMaxUsesReached: boolean
  isActive: boolean
  createdAt: Date
  expiresAt: Date | null
}

/**
 * Create a new share link for a conversation
 *
 * @param userId - ID of the user creating the share
 * @param conversationId - ID of the conversation to share
 * @param options - Share configuration options
 */
export async function createShareLink(
  userId: string,
  conversationId: string,
  options: CreateShareOptions = {}
): Promise<ShareResult> {
  try {
    // Verify user is part of the conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { users: true },
    })

    if (!conversation) {
      return { success: false, error: "Conversation not found" }
    }

    const isUserInConversation = conversation.users.some((user) => user.id === userId)

    if (!isUserInConversation) {
      return { success: false, error: "You are not part of this conversation" }
    }

    // Generate unique share token
    const shareToken = generateShareToken()

    // Create the share
    const share = await prisma.conversationShare.create({
      data: {
        conversationId,
        createdById: userId,
        shareToken,
        shareType: options.shareType || ShareType.LINK,
        permission: options.permission || SharePermission.VIEW,
        expiresAt: options.expiresAt || null,
        maxUses: options.maxUses || null,
        allowedEmails: options.allowedEmails || [],
        name: options.name || null,
        isActive: true,
        useCount: 0,
      },
    })

    return { success: true, share }
  } catch (error) {
    console.error("CREATE_SHARE_ERROR", error)
    return { success: false, error: "Failed to create share link" }
  }
}

/**
 * Get share by token and validate it
 *
 * @param token - The share token to look up
 * @returns Share info if valid, error otherwise
 */
export async function getShareByToken(
  token: string
): Promise<{ success: boolean; shareInfo?: ShareInfo; error?: string }> {
  try {
    const share = await prisma.conversationShare.findUnique({
      where: { shareToken: token },
      include: {
        conversation: {
          include: {
            users: true,
            _count: {
              select: { messages: true },
            },
          },
        },
      },
    })

    if (!share) {
      return { success: false, error: "Share link not found" }
    }

    // Check if share is active
    if (!share.isActive) {
      return { success: false, error: "This share link has been deactivated" }
    }

    // Check if expired
    const isExpired = share.expiresAt ? new Date() > share.expiresAt : false
    if (isExpired) {
      return { success: false, error: "This share link has expired" }
    }

    // Check if max uses reached
    const isMaxUsesReached = share.maxUses ? share.useCount >= share.maxUses : false
    if (isMaxUsesReached) {
      return {
        success: false,
        error: "This share link has reached its maximum uses",
      }
    }

    const shareInfo: ShareInfo = {
      id: share.id,
      conversationId: share.conversationId,
      conversationName: share.conversation.name,
      messageCount: share.conversation._count.messages,
      participantCount: share.conversation.users.length,
      permission: share.permission,
      shareType: share.shareType,
      isExpired,
      isMaxUsesReached,
      isActive: share.isActive,
      createdAt: share.createdAt,
      expiresAt: share.expiresAt,
    }

    return { success: true, shareInfo }
  } catch (error) {
    console.error("GET_SHARE_BY_TOKEN_ERROR", error)
    return { success: false, error: "Failed to get share information" }
  }
}

/**
 * Join a conversation via share token
 *
 * @param userId - ID of the user joining
 * @param userEmail - Email of the user joining
 * @param shareToken - The share token to use
 */
export async function joinViaShare(
  userId: string,
  userEmail: string,
  shareToken: string
): Promise<{
  success: boolean
  conversationId?: string
  permission?: SharePermission
  error?: string
}> {
  try {
    const share = await prisma.conversationShare.findUnique({
      where: { shareToken },
      include: {
        conversation: {
          include: { users: true },
        },
      },
    })

    if (!share) {
      return { success: false, error: "Share link not found" }
    }

    // Check if share is active
    if (!share.isActive) {
      return { success: false, error: "This share link has been deactivated" }
    }

    // Check if expired
    if (share.expiresAt && new Date() > share.expiresAt) {
      return { success: false, error: "This share link has expired" }
    }

    // Check if max uses reached
    if (share.maxUses && share.useCount >= share.maxUses) {
      return {
        success: false,
        error: "This share link has reached its maximum uses",
      }
    }

    // Check if invite-only and user email is allowed
    if (share.shareType === ShareType.INVITE) {
      const isEmailAllowed = share.allowedEmails.some(
        (email) => email.toLowerCase() === userEmail.toLowerCase()
      )
      if (!isEmailAllowed) {
        return {
          success: false,
          error: "You are not invited to this conversation",
        }
      }
    }

    // Check if user is already in conversation
    const isAlreadyMember = share.conversation.users.some((user) => user.id === userId)

    if (isAlreadyMember) {
      // User is already a member, just return success
      return {
        success: true,
        conversationId: share.conversationId,
        permission: share.permission,
      }
    }

    // Add user to conversation
    await prisma.conversation.update({
      where: { id: share.conversationId },
      data: {
        users: {
          connect: { id: userId },
        },
      },
    })

    // Increment use count
    await prisma.conversationShare.update({
      where: { id: share.id },
      data: {
        useCount: {
          increment: 1,
        },
      },
    })

    return {
      success: true,
      conversationId: share.conversationId,
      permission: share.permission,
    }
  } catch (error) {
    console.error("JOIN_VIA_SHARE_ERROR", error)
    return { success: false, error: "Failed to join conversation" }
  }
}

/**
 * Revoke a share (soft delete by deactivating)
 *
 * @param userId - ID of the user revoking the share
 * @param shareId - ID of the share to revoke
 */
export async function revokeShare(
  userId: string,
  shareId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const share = await prisma.conversationShare.findUnique({
      where: { id: shareId },
      include: {
        conversation: {
          include: { users: true },
        },
      },
    })

    if (!share) {
      return { success: false, error: "Share not found" }
    }

    // Check if user is part of the conversation
    const isUserInConversation = share.conversation.users.some((user) => user.id === userId)

    if (!isUserInConversation) {
      return { success: false, error: "You cannot revoke this share" }
    }

    // Only the creator or a conversation member can revoke
    // For additional security, you could restrict to just the creator:
    // if (share.createdById !== userId) {
    //   return { success: false, error: 'Only the share creator can revoke it' }
    // }

    await prisma.conversationShare.update({
      where: { id: shareId },
      data: {
        isActive: false,
      },
    })

    return { success: true }
  } catch (error) {
    console.error("REVOKE_SHARE_ERROR", error)
    return { success: false, error: "Failed to revoke share" }
  }
}

/**
 * Update share settings
 *
 * @param userId - ID of the user updating the share
 * @param shareId - ID of the share to update
 * @param updates - Partial share options to update
 */
export async function updateShare(
  userId: string,
  shareId: string,
  updates: Partial<
    Pick<CreateShareOptions, "permission" | "expiresAt" | "maxUses" | "allowedEmails" | "name">
  > & { isActive?: boolean }
): Promise<ShareResult> {
  try {
    const share = await prisma.conversationShare.findUnique({
      where: { id: shareId },
      include: {
        conversation: {
          include: { users: true },
        },
      },
    })

    if (!share) {
      return { success: false, error: "Share not found" }
    }

    // Check if user is part of the conversation
    const isUserInConversation = share.conversation.users.some((user) => user.id === userId)

    if (!isUserInConversation) {
      return { success: false, error: "You cannot update this share" }
    }

    const updatedShare = await prisma.conversationShare.update({
      where: { id: shareId },
      data: {
        permission: updates.permission,
        expiresAt: updates.expiresAt,
        maxUses: updates.maxUses,
        allowedEmails: updates.allowedEmails,
        name: updates.name,
        isActive: updates.isActive,
      },
    })

    return { success: true, share: updatedShare }
  } catch (error) {
    console.error("UPDATE_SHARE_ERROR", error)
    return { success: false, error: "Failed to update share" }
  }
}

/**
 * Get all shares for a conversation
 *
 * @param userId - ID of the user requesting shares
 * @param conversationId - ID of the conversation
 */
export async function getSharesForConversation(
  userId: string,
  conversationId: string
): Promise<{
  success: boolean
  shares?: Awaited<ReturnType<typeof prisma.conversationShare.findMany>>
  error?: string
}> {
  try {
    // Verify user is part of the conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { users: true },
    })

    if (!conversation) {
      return { success: false, error: "Conversation not found" }
    }

    const isUserInConversation = conversation.users.some((user) => user.id === userId)

    if (!isUserInConversation) {
      return { success: false, error: "You are not part of this conversation" }
    }

    const shares = await prisma.conversationShare.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
    })

    return { success: true, shares }
  } catch (error) {
    console.error("GET_SHARES_ERROR", error)
    return { success: false, error: "Failed to get shares" }
  }
}

/**
 * Delete a share permanently
 *
 * @param userId - ID of the user deleting the share
 * @param shareId - ID of the share to delete
 */
export async function deleteShare(
  userId: string,
  shareId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const share = await prisma.conversationShare.findUnique({
      where: { id: shareId },
      include: {
        conversation: {
          include: { users: true },
        },
      },
    })

    if (!share) {
      return { success: false, error: "Share not found" }
    }

    // Check if user is part of the conversation
    const isUserInConversation = share.conversation.users.some((user) => user.id === userId)

    if (!isUserInConversation) {
      return { success: false, error: "You cannot delete this share" }
    }

    await prisma.conversationShare.delete({
      where: { id: shareId },
    })

    return { success: true }
  } catch (error) {
    console.error("DELETE_SHARE_ERROR", error)
    return { success: false, error: "Failed to delete share" }
  }
}

/**
 * Cleanup expired shares
 * Should be run periodically (e.g., via cron job)
 */
export async function cleanupExpiredShares(): Promise<{
  success: boolean
  deletedCount?: number
  error?: string
}> {
  try {
    const result = await prisma.conversationShare.deleteMany({
      where: {
        OR: [
          // Expired shares
          {
            expiresAt: {
              lt: new Date(),
            },
          },
          // Shares that have reached max uses and are inactive
          {
            isActive: false,
            maxUses: { not: null },
            useCount: { gte: 0 },
          },
        ],
      },
    })

    return { success: true, deletedCount: result.count }
  } catch (error) {
    console.error("CLEANUP_SHARES_ERROR", error)
    return { success: false, error: "Failed to cleanup expired shares" }
  }
}

/**
 * Check if a user can view messages in a shared conversation
 *
 * @param userId - ID of the user
 * @param conversationId - ID of the conversation
 */
export async function canViewSharedConversation(
  userId: string,
  conversationId: string
): Promise<boolean> {
  try {
    // Check if user is a direct member
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { users: true },
    })

    if (conversation?.users.some((user) => user.id === userId)) {
      return true
    }

    return false
  } catch {
    return false
  }
}

/**
 * Get share URL from token
 */
export function getShareUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  return `${baseUrl}/join/${token}`
}
