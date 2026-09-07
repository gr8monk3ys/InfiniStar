/**
 * The publisher for conversation events.
 *
 * `pusher-server.ts` is a lazily-initialised client and `pusher-channels.ts`
 * builds three channel strings; neither knows what an event is. Before this
 * module, every route picked its own event name and handed the Pusher SDK a raw
 * Prisma result, and three things followed from that:
 *
 *  - **Pairings came apart.** A new message has to reach two places: the open
 *    conversation view (`messages:new` on the conversation channel) and each
 *    participant's sidebar (`conversation:update` on their user channel).
 *    `/api/ai/chat-stream` — the default send path — emitted only the first,
 *    while `/api/ai/chat` and `/api/ai/image/generate` emitted both, so the
 *    sidebar's last-message preview only caught up on the next server render.
 *
 *  - **One event name carried two meanings.** The share-join routes broadcast a
 *    whole conversation as `conversation:update` to announce a new Participant,
 *    but the only handler for that event reads `conversation.messages` and
 *    discards `users`, so joining via a share link was invisible to everyone
 *    already in the conversation until they reloaded. A new Participant is a
 *    different event, and now has a different name.
 *
 *  - **A Pusher outage 500'd requests whose write had already committed.**
 *    Containment existed at exactly one of 32 call sites, as a helper private to
 *    its own route module. Publishing is best-effort here: the database write is
 *    the source of truth and the client reconciles on its next read, so a failed
 *    publish is logged and swallowed rather than failing the request.
 *
 * The `message` parameter is typed `FullMessageType`, which is the seam
 * `conversation-select.ts` could not enforce on its own: handing a narrow Prisma
 * result to `pusherServer.trigger` type-checked, because the trigger payload is
 * `any`. Publishing through this module makes a missing `replyTo` a compile
 * error at the publish site.
 *
 * Scope: this module owns the message lifecycle and participant membership —
 * the events where a payload shape and a pairing invariant exist. The
 * conversation-state events (pin, archive, mute, tag) are deliberately still
 * spelled at their call sites: each is a single event on a single channel with a
 * small literal payload and nothing to keep in step, so a named function per
 * event would be a rename rather than a seam.
 */

import { apiLogger } from "@/app/lib/logger"
import { getPusherConversationChannel, getPusherUserChannel } from "@/app/lib/pusher-channels"
import { pusherServer } from "@/app/lib/pusher-server"
import { type FullMessageType, type UserSummary } from "@/app/types"

/**
 * Every publish in this module is best-effort. The caller's database write has
 * already committed by the time it publishes, so a Pusher failure must not turn
 * a successful mutation into a 500 — the client reconciles on its next read.
 */
async function publish(channel: string, event: string, payload: unknown): Promise<void> {
  try {
    await pusherServer.trigger(channel, event, payload)
  } catch (error) {
    apiLogger.error({ err: error, channel, event }, "PUSHER_PUBLISH_FAILED")
  }
}

async function publishToEach(
  userIds: readonly string[],
  event: string,
  payload: unknown
): Promise<void> {
  await Promise.all(userIds.map((userId) => publish(getPusherUserChannel(userId), event, payload)))
}

interface NewMessageArgs {
  conversationId: string
  message: FullMessageType
  /**
   * Participants whose sidebar should update. Usually every user on the
   * conversation; for an AI turn, the one chatter in it.
   */
  notify: readonly string[]
}

/**
 * A message was added to a conversation.
 *
 * Emits both halves of the pairing: the conversation channel so an open thread
 * appends it, and each participant's user channel so their sidebar re-sorts and
 * shows the new preview. Callers cannot emit one without the other.
 */
export async function publishNewMessage({
  conversationId,
  message,
  notify,
}: NewMessageArgs): Promise<void> {
  await publish(getPusherConversationChannel(conversationId), "messages:new", message)
  await publishToEach(notify, "conversation:update", {
    id: conversationId,
    messages: [message],
  })
}

interface MessageChangeArgs {
  conversationId: string
  message: FullMessageType
}

/** An existing message's content changed (an edit, or a regenerated reply). */
export async function publishMessageUpdated({
  conversationId,
  message,
}: MessageChangeArgs): Promise<void> {
  await publish(getPusherConversationChannel(conversationId), "message:update", message)
}

/** An existing message was soft-deleted. */
export async function publishMessageDeleted({
  conversationId,
  message,
}: MessageChangeArgs): Promise<void> {
  await publish(getPusherConversationChannel(conversationId), "message:delete", message)
}

/** A reaction was added to or removed from an existing message. */
export async function publishMessageReaction({
  conversationId,
  message,
}: MessageChangeArgs): Promise<void> {
  await publish(getPusherConversationChannel(conversationId), "message:reaction", message)
}

interface MessageSeenArgs extends MessageChangeArgs {
  /** The participant who just saw it — their sidebar clears its unread mark. */
  viewerId: string
}

/**
 * A participant read the newest message.
 *
 * Like an edit this changes an existing message, but it also changes the
 * viewer's own sidebar, so it carries the `conversation:update` half too.
 */
export async function publishMessageSeen({
  conversationId,
  message,
  viewerId,
}: MessageSeenArgs): Promise<void> {
  await publishToEach([viewerId], "conversation:update", {
    id: conversationId,
    messages: [message],
  })
  await publish(getPusherConversationChannel(conversationId), "message:update", message)
}

interface ParticipantJoinedArgs {
  conversationId: string
  /** The conversation's participants after the join. */
  users: readonly UserSummary[]
  /** Existing participants to tell. The joiner is normally excluded. */
  notify: readonly string[]
}

/**
 * Someone joined the conversation through a share link.
 *
 * This used to be sent as `conversation:update`, whose handler reads
 * `messages` and drops `users`, so the join was invisible to everyone already
 * there. It has its own event name so its payload cannot be mistaken for a new
 * message.
 */
export async function publishParticipantJoined({
  conversationId,
  users,
  notify,
}: ParticipantJoinedArgs): Promise<void> {
  await publishToEach(notify, "conversation:participants", {
    id: conversationId,
    users,
  })
}
