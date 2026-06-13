# Performance Roadmap

Findings from a full performance audit (build artifacts measured directly; Next 16
webpack mode does not print a First-Load-JS column). Ordered by impact-to-risk.
Nothing here is a blind "quick win" — each item was checked, and the unsafe ones
are called out so they aren't attempted naively.

## What is already good (verified — do not "fix")

- **Code-splitting is aggressive and correct.** recharts (501 KB), react-select,
  next-cloudinary, prismjs/CodeBlock, ShareDialog, MemoryManager, all modals,
  ProfileDrawer, SearchModal, TwoFactorSettings are `next/dynamic`. recharts is
  **not** on the chat critical path.
- **No react-markdown** — `MarkdownRenderer` is a lightweight hand-rolled parser;
  the syntax highlighter is lazy-loaded only when a code block renders.
- **react-icons** uses per-icon named imports (tree-shaken).
- **DB indexes match the hot paths**: `Message[conversationId, createdAt]` and
  `[conversationId, isDeleted, createdAt]`, `Conversation[lastMessageAt]`,
  `Character[isPublic, featured]`/`[isPublic, isNsfw]`, `AiUsage[userId, createdAt]`.
  No missing-index issues found.
- Anthropic prompt caching (`cache_control: ephemeral`) on the system prompt.

## High value — do these (each warrants its own focused, reviewed change)

### 1. Cache the public marketing/explore queries (biggest server win)

`app/(marketing)/explore/page.tsx` is `force-dynamic` and runs ~4 Prisma queries
per anonymous request (featured/trending/all/likes); the homepage adds ~2 more.
These are public and shared; characters change rarely. Wrap the anonymous lists in
`unstable_cache` (`revalidate: 300`, tag `characters-public`, busted on character
create/publish) and serve cached, unranked lists to logged-out users. Run
`rankCharactersForUser` only for authenticated users. Converts dominant public
traffic from 4–6 DB round-trips to ~0 on a cache hit.
**Risk:** correctness of cache busting — must invalidate the tag on character
publish/unpublish/delete.

### 2. Parallelize the chat-send pre-first-token chain (biggest latency win)

`app/api/ai/chat-stream/route.ts`: before the first token streams, these run
**serially** and are mutually independent — `moderateTextModelAssisted`,
`conversation.findFirst`, `getAiAccessDecision`, and `getRelevantMemories`
(the last currently runs inside the stream `start()`). `Promise.all` them and
keep the existing block/auth/access checks afterward. Overlaps ~300–500 ms.
**Behavior-preserving** as long as the post-resolution checks (moderation block,
membership 403, access 402) stay in place and ordered the same.
**Risk:** safety-critical path; do it in isolation with the full chat-stream test
suite. Do NOT also move OpenAI moderation off the block path (see below).

### 3. Wire real message pagination

`getMessages` already supports cursor pagination but nothing calls it with a
cursor — long conversations are silently truncated to the last 50 messages and
`Body.tsx` only virtualizes the in-memory array. Add an IntersectionObserver at
the top of the virtual list to fetch older pages. Server plumbing already exists.

## Do NOT do naively (verified unsafe / misattributed)

- **Trimming `seen` from the `getConversations` last-message include** — the
  conversation list (`ConversationBox.tsx:51`) renders read receipts from
  `lastMessage.seen`. Removing it breaks the UI.
- **Trimming the `messages:new` Pusher payload** — the client renders the full
  `FullMessageType` (sender, seen, replyTo). Trimming fields breaks message
  rendering for other participants unless the client is changed to refetch.
  (The 10 KB Pusher cap is a real risk only for very long messages; needs a
  considered client+server change, not a blind trim.)
- **Lazy-loading "emoji-mart" on the chat route** — MessageBox uses a static
  `commonEmojis` array, not emoji-mart; there is nothing to split there.
- **Moving OpenAI moderation off the block path** — for an adult-content-adjacent
  product, making the model-assisted block check async/post-hoc weakens the safety
  gate. Treat as a product/safety decision, not a perf change.
