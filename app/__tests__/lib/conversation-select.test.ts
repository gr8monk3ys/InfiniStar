import { execFileSync } from "node:child_process"
import path from "node:path"

import {
  CONVERSATION_INCLUDE,
  MESSAGE_INCLUDE,
  MESSAGE_INCLUDE_FLAT,
  PARTICIPANT_SELECT,
} from "@/app/lib/conversation-select"

const REPO_ROOT = path.resolve(__dirname, "../../..")

/**
 * `include: { users: true }` and `include: { sender: true }` return every
 * column of the User row. Those rows are returned in HTTP responses and
 * broadcast over Pusher to every subscriber on a conversation channel, so a
 * raw include ships credentials and billing identifiers to other participants.
 *
 * These tests pin the safe projection and then check that nothing has gone
 * back to the raw form.
 */
describe("participant projection", () => {
  const FORBIDDEN = [
    "hashedPassword",
    "clerkId",
    "stripeCustomerId",
    "stripeSubscriptionId",
    "stripePriceId",
    "stripeCurrentPeriodEnd",
    "utmSource",
    "utmMedium",
    "utmCampaign",
    "referredById",
    "mutedConversations",
    "twoFactorSecret",
    "nsfwEnabled",
    "adultConfirmedAt",
  ]

  it("selects only the fields the client actually renders", () => {
    expect(Object.keys(PARTICIPANT_SELECT).sort()).toEqual([
      "createdAt",
      "email",
      "id",
      "image",
      "name",
    ])
  })

  it("carries no credential, billing or attribution column", () => {
    for (const field of FORBIDDEN) {
      expect(PARTICIPANT_SELECT).not.toHaveProperty(field)
    }
  })

  it("projects the sender, the seen list and the quoted parent", () => {
    expect(MESSAGE_INCLUDE.sender).toEqual({ select: PARTICIPANT_SELECT })
    expect(MESSAGE_INCLUDE.seen).toEqual({ select: PARTICIPANT_SELECT })
    expect(MESSAGE_INCLUDE.replyTo).toEqual({
      include: { sender: { select: PARTICIPANT_SELECT } },
    })
  })

  it("projects the flat message shape and the conversation participants", () => {
    expect(MESSAGE_INCLUDE_FLAT.sender).toEqual({ select: PARTICIPANT_SELECT })
    expect(MESSAGE_INCLUDE_FLAT).not.toHaveProperty("replyTo")
    expect(CONVERSATION_INCLUDE.users).toEqual({ select: PARTICIPANT_SELECT })
  })
})

describe("no raw user includes remain in app/", () => {
  /**
   * The regression guard. A new route that writes `include: { users: true }`
   * reintroduces the leak silently, because TypeScript is structural and the
   * extra columns satisfy the narrowed type at compile time.
   */
  it("finds no `users: true`, `sender: true` or `seen: true` outside the select module", () => {
    let output = ""
    try {
      output = execFileSync(
        "grep",
        ["-rnE", "\\b(users|sender|seen):\\s*true\\b", "--include=*.ts", "--include=*.tsx", "app"],
        { cwd: REPO_ROOT, encoding: "utf8" }
      )
    } catch (error) {
      // grep exits 1 when there are no matches, which is the passing case.
      const status = (error as { status?: number }).status
      if (status !== 1) throw error
      output = ""
    }

    const offenders = output
      .split("\n")
      .filter(Boolean)
      .filter((line) => !line.startsWith("app/lib/conversation-select.ts"))
      .filter((line) => !line.startsWith("app/__tests__/"))

    expect(offenders).toEqual([])
  })
})
