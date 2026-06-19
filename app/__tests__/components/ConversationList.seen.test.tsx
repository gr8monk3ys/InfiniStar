import React from "react"
import { render, screen } from "@testing-library/react"

import ConversationList from "@/app/(dashboard)/dashboard/conversations/components/ConversationList"

/**
 * Regression guard for the "seen" indicator in the default config.
 *
 * When group chat is disabled (the default), the layout ships an EMPTY user
 * directory to the client. The current-user email must therefore come from the
 * authenticated session (a prop), not be derived from that empty array — else
 * every conversation renders as permanently unread. This asserts ConversationList
 * hands the session email down to ConversationBox even when `user` is empty.
 */

// Group chat off (the default) — the user directory is empty.
jest.mock("@/app/lib/features", () => ({
  isGroupChatEnabled: () => false,
}))

jest.mock("@/app/hooks/useTags", () => ({
  useTags: () => ({ tags: [] }),
}))

jest.mock("@/app/(dashboard)/dashboard/components/GlobalSearchProvider", () => ({
  useGlobalSearchContext: () => ({ open: jest.fn() }),
}))

jest.mock("@/app/(dashboard)/dashboard/components/KeyboardShortcutsProvider", () => ({
  useKeyboardShortcutsContext: () => ({
    selectedConversationIndex: -1,
    setSelectedConversationIndex: jest.fn(),
    setConversationCount: jest.fn(),
    setSelectedConversationHref: jest.fn(),
    openNewAIConversation: jest.fn(),
  }),
}))

jest.mock("@/app/(dashboard)/dashboard/hooks/useConversation", () => ({
  __esModule: true,
  default: () => ({ conversationId: "", isOpen: false }),
}))

jest.mock("@/app/(dashboard)/dashboard/hooks/usePusherConversationSync", () => ({
  usePusherConversationSync: jest.fn(),
}))

// Mock the leaf so we can read exactly what email ConversationList passes down.
jest.mock("@/app/(dashboard)/dashboard/conversations/components/ConversationBox", () => {
  const ReactLib = require("react")
  return {
    __esModule: true,
    default: (props: { currentUserEmail?: string | null }) =>
      ReactLib.createElement("div", {
        "data-testid": "conversation-box",
        "data-email": props.currentUserEmail ?? "NULL",
      }),
  }
})

describe("ConversationList seen-indicator wiring", () => {
  it("passes the session email to ConversationBox even when the user directory is empty", () => {
    const item = {
      id: "c1",
      archivedBy: [],
      pinnedBy: [],
      tags: [],
      lastMessageAt: new Date("2026-01-01").toISOString(),
      messages: [],
      users: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    render(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      React.createElement(ConversationList as any, {
        initialItems: [item],
        user: [], // group chat off → empty directory
        currentUserId: "u1",
        currentUserEmail: "me@example.com",
        initialNotificationPrefs: null,
        sceneCharacters: [],
      })
    )

    expect(screen.getByTestId("conversation-box")).toHaveAttribute("data-email", "me@example.com")
  })
})
