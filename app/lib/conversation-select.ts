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
 * `email` used to be here, because the seen-indicator matched participants by
 * email rather than by id — which put every account's address on every
 * conversation channel and in every message response, and compared two
 * `string | null` values, so two participants without an email compared equal.
 * The three comparisons (MessageBox, ConversationBox, useOtherUser) match on id
 * now, and `email` is an asserted absence in the test rather than a documented
 * exception.
 */
export const PARTICIPANT_SELECT = {
  id: true,
  name: true,
  image: true,
  createdAt: true,
} satisfies Prisma.UserSelect

/**
 * The one shape of a message on the wire: what `getMessages` returns, what the
 * message routes respond with, and what every Pusher publisher sends.
 *
 * There is deliberately no narrower variant. The client reducer replaces the
 * whole message object rather than merging into it, so a publisher reading a
 * narrower shape does not merely omit a field on the wire — it *deletes* that
 * field from state for every subscriber until the next full reload. A
 * `MESSAGE_INCLUDE_FLAT` without `replyTo` existed here for exactly the reason
 * this comment warns about, and it cost the quoted parent on every edit,
 * reaction, delete, regeneration and seen-receipt.
 *
 * The publish path is not type-checked — `pusherServer.trigger` takes an
 * untyped payload — so the guard that keeps this honest is the grep in
 * `conversation-select.test.ts`: no message include may be spelled inline
 * outside this module. `FullMessageType.replyTo` is required, which catches
 * consumers but not publishers.
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
 * A conversation with its participants projected safely. Use for any
 * conversation that is returned to a client or broadcast.
 */
export const CONVERSATION_INCLUDE = {
  users: { select: PARTICIPANT_SELECT },
} satisfies Prisma.ConversationInclude
