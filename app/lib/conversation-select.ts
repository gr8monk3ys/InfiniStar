import type { Prisma } from "@prisma/client"

/**
 * The safe projection of a `User` when they appear as somebody else's
 * conversation participant, message sender, or seen-marker.
 *
 * Why this exists: `include: { users: true }` and `include: { sender: true }`
 * return every column of the `User` row, and those rows are both returned in
 * HTTP responses and broadcast over Pusher to every subscriber on a
 * conversation channel. That shipped `hashedPassword`, `clerkId`, `email`,
 * `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId` and the
 * attribution columns to every participant of every group conversation.
 *
 * `getCurrentUser` was hardened with `omit: { hashedPassword: true }`, but that
 * hardening is per-call-site, so the ~37 places that build their own include
 * never got it. State the safe shape once instead.
 *
 * Matches the `UserSummary` type in `app/types`.
 *
 * Note: `email` is still here because the seen-indicator matches participants
 * by email rather than by id. Matching on id and dropping email from this
 * projection is a follow-up; it is a behaviour change, not a leak fix.
 */
export const PARTICIPANT_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
  createdAt: true,
} satisfies Prisma.UserSelect

/**
 * The canonical shape of a message on the wire: what `getMessages` returns,
 * what the message routes respond with, and what every Pusher publisher must
 * send. Keeping one constant is what stops publishers from disagreeing — six
 * of them previously omitted `replyTo`, and the client reducer replaces the
 * whole object, so an edit or a reaction silently dropped the quote.
 */
export const MESSAGE_INCLUDE = {
  sender: { select: PARTICIPANT_SELECT },
  seen: { select: PARTICIPANT_SELECT },
  replyTo: {
    include: {
      sender: { select: PARTICIPANT_SELECT },
    },
  },
} satisfies Prisma.MessageInclude

/**
 * `MESSAGE_INCLUDE` without the quoted parent, for the publishers that never
 * carried one. Prefer `MESSAGE_INCLUDE`; this exists for update paths where
 * the quote is genuinely irrelevant.
 */
export const MESSAGE_INCLUDE_FLAT = {
  sender: { select: PARTICIPANT_SELECT },
  seen: { select: PARTICIPANT_SELECT },
} satisfies Prisma.MessageInclude

/**
 * A conversation with its participants projected safely. Use for any
 * conversation that is returned to a client or broadcast.
 */
export const CONVERSATION_INCLUDE = {
  users: { select: PARTICIPANT_SELECT },
} satisfies Prisma.ConversationInclude

/**
 * A conversation with its participants and its messages, both projected
 * safely. The detail shape.
 */
export const CONVERSATION_WITH_MESSAGES_INCLUDE = {
  users: { select: PARTICIPANT_SELECT },
  messages: {
    include: MESSAGE_INCLUDE,
  },
} satisfies Prisma.ConversationInclude
