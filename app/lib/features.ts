import { isEnabled } from "@/app/lib/monetization"

/**
 * Human-to-human group chat.
 *
 * Defaults to OFF. The product is character-first AI chat; group chat is a
 * legacy multiplayer-messaging surface with no discovery model, and enabling it
 * exposes the full user directory (every account's name/email/avatar) to every
 * user via the new-group picker. Keep it off unless you intentionally want a
 * social/messaging product. Scene chat (multiple AI characters) is unaffected —
 * that is on-brand and always available.
 */
export function isGroupChatEnabled(): boolean {
  return isEnabled(process.env.NEXT_PUBLIC_ENABLE_GROUP_CHAT)
}
