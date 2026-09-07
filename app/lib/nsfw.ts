import { type ModerationPosture } from "@/app/lib/moderation"

/**
 * Mature content: what an account may see, publish, and be moderated as.
 *
 * CONTEXT.md: mature content is "reachable only by an account that has
 * confirmed adulthood *and* opted in; the two are separate facts and both are
 * required."
 *
 * This used to be a single boolean, and a boolean can only answer one of the
 * four questions callers actually have. The other three were answered
 * separately at each call site, and two of them were answered wrongly:
 *
 *  - **Moderation never learned the answer.** The AI routes computed
 *    `canAccessNsfw` and used it only for the character gate; the Turn's input
 *    was then moderated with no knowledge of it. A consenting adult in a mature
 *    conversation filed an OPEN `ContentReport` against their own conversation
 *    whenever a turn tripped a `sexual` review rule — a moderation queue that
 *    fills in proportion to exactly the traffic the age gate exists to permit.
 *
 *  - **Publishing checked one fact of the two.** `characters/route.ts` and
 *    `characters/[characterId]/route.ts` both tested `!currentUser.isAdult`
 *    alone, so an account holding `isAdult: true, nsfwEnabled: false` could
 *    publish a Character it was itself filtered out of seeing.
 *
 * Returning a posture rather than a boolean moves each of those from "did the
 * route remember to think about it" to "the module cannot be called without it".
 */

export interface MatureViewer {
  isAdult?: boolean | null
  nsfwEnabled?: boolean | null
  adultConfirmedAt?: Date | null
}

export interface MatureAccess {
  /** May this account see mature Characters and conversations? */
  canView: boolean
  /**
   * May this account publish a mature Character?
   *
   * The same two facts as `canView`. Publishing content you have not opted in
   * to see is incoherent, and it is what the two call sites that checked only
   * `isAdult` used to allow.
   */
  canAuthor: boolean
  /**
   * How this account's own content should be moderated. `mature` suppresses the
   * consenting-adults *review* signal only; every block rule is unaffected.
   */
  moderationPosture: ModerationPosture
  /**
   * Prisma `where` fragment for any listing of Characters. Spread it — it is
   * empty for an account that may see mature content, and `{ isNsfw: false }`
   * otherwise, which is the filter four call sites hand-wrote.
   */
  visibilityFilter: { isNsfw?: false }
}

export function matureAccess(user: MatureViewer | null | undefined): MatureAccess {
  const permitted = Boolean(user?.isAdult && user?.nsfwEnabled && user?.adultConfirmedAt)

  return {
    canView: permitted,
    canAuthor: permitted,
    moderationPosture: permitted ? "mature" : "standard",
    visibilityFilter: permitted ? {} : { isNsfw: false },
  }
}

/**
 * Whether this account may see mature content.
 *
 * Kept because it reads well at the gate call sites, which only ever want this
 * one question. It is `matureAccess(user).canView` and nothing else.
 */
export function canAccessNsfw(user: MatureViewer | null | undefined): boolean {
  return matureAccess(user).canView
}
