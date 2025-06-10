export const PUSHER_PRESENCE_CHANNEL = "presence-messenger" as const

export function getPusherUserChannel(userId: string): string {
  return `private-user-${userId}`
}

export function getPusherConversationChannel(conversationId: string): string {
  return `private-conversation-${conversationId}`
}
