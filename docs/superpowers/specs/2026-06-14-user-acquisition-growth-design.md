# InfiniStar User-Acquisition Growth Program — Design Spec

- **Date:** 2026-06-14
- **Status:** Approved design (pending spec review) → next step: implementation plan for P0+P1
- **Owner:** Lorenzo
- **Scope:** A sequenced, supply-driven organic growth program for InfiniStar (a Character.ai competitor). Six phases; each phase becomes its own implementation plan. Paid acquisition is last and capped.

---

## 1. Context & goal

InfiniStar is a character-roleplay platform (Next.js 16 App Router, Prisma/Postgres, Clerk, Stripe $9.99/mo PRO, Anthropic Claude). The product is feature-complete; the stated priority is **user acquisition, not more features**. There is no meaningful ad budget, so the strategy is **product-led / organic**.

**Goal:** stand up a repeatable, compounding acquisition engine that costs ~$0 in media — using surfaces the codebase already has — and instrument it so every change is measurable.

## 2. Key findings from codebase grounding

These corrected the initial survey and shape the plan:

1. **No analytics exist at all.** `package.json` has zero analytics deps; `app/layout.tsx`/`ClientShell.tsx` render no tag. The `gtag` strings found by grep are dead/stub code. (The earlier "GA via gtag" assumption was false.)
2. **`app/sitemap.ts` is static** — 6 hardcoded routes, listing **zero** of the per-character or per-creator UGC pages that scale with content.
3. **The #1 funnel leak is a single line:** `CharacterStartChatButton.tsx:17` hard-redirects every logged-out "Start Chat" click to `/sign-in`. 100% of anonymous intent dies there.
4. **No attribution** anywhere on `User` (no `utm*`, no `referredById`).
5. **The hard halves of the flywheel already exist:** every public character is a server-rendered, slug-keyworded, OG-tagged page (`app/(marketing)/characters/[slug]/page.tsx`); there is a remix/fork loop (`/api/characters/[characterId]/remix`); and a social graph (`UserFollow`, `CharacterComment`, `CreatorTip`/`CreatorSubscription`) is wired in `prisma/schema.prisma`.
6. **Reusable scaffolding for attribution:** `AffiliateClick` (model + `/api/affiliate/[partnerId]` redirect route + allowlisted `/api/affiliate/summary`) is a copy-paste pattern for referral tracking. The Clerk `user.created` webhook is the single signup chokepoint. The edge-runtime `app/opengraph-image.tsx` `ImageResponse` is a clonable OG-card template.
7. **SFW filter already exists and is reused** across explore/feed/home/creator pages (`canAccessNsfw=false` / `isNsfw:false`, backed by `@@index([isPublic,isNsfw])`). It is the single canonical filter for every crawler-, share-, and ad-visible surface.

## 3. Thesis & strategy

Closing the gaps is **plumbing**, not new product. The correct order is **cheapest-compounding-first, foundation-before-channels**:

1. Instrument the funnel first (so every later change is falsifiable).
2. Unlock indexing of all SFW UGC (free, compounding, weeks to mature — start the clock early).
3. Plug the conversion leak with a guest try-before-signup path (monetizes all traffic the other phases create).
4. Turn shared links into high-CTR acquisition surfaces (OG cards) and creators into a distribution channel (attribution + recognition).
5. Only then run a **capped, measurement-only** paid test.

Paid is structurally underwater: ~$30–60 LTV ($9.99/mo × 3–6mo retention) vs $1.50–4 CPC on the handful of channels that even allow AI-companion content. It is justified only to produce a CAC number and a keep/kill decision.

## 4. The compounding flywheel

**Supply → Index → Discover → Convert → Share → (recognition) → Supply.**

A creator publishes/remixes a public character → the dynamic sitemap + JSON-LD make that page indexable → a long-tail searcher finds it → a designed OG card makes the same page share beautifully → the visitor gets guest-try messages and converts instead of dead-ending → the creator/sharer who drove that signup is credited and ranked, earning status to publish and share more.

The reinforcement is multiplicative because **the same character page is simultaneously the SEO landing page, the share target, and the referral destination** — one surface serves three loops, so every improvement to it compounds across all three. Measurement (P0) sits underneath the whole flywheel; clean view-tracking (P1) keeps the social-proof and leaderboard signals trustworthy. The loop's marginal cost per new user trends toward Anthropic token COGS alone.

---

## 5. Phased roadmap

Effort key: **S** ≈ ≤1 day, **M** ≈ a few days, **L** ≈ 1–2 weeks. Each phase is its own implementation plan; P0 and P1 are detailed enough to plan immediately.

### Phase 0 — Measurement substrate _(effort: M)_ — **hard prerequisite for everything**

**Goal:** make every subsequent growth change falsifiable; capture acquisition source at the signup chokepoint.

**Build:**

- Add `posthog-js` + `posthog-node`. Mount `PostHogProvider` in `app/components/providers/ClientShell.tsx` behind the existing `CookieBanner` consent. Reverse-proxy ingestion via a Next.js rewrite (e.g. `/ingest` → PostHog EU Cloud) to survive ad-blockers. Add a thin server singleton `app/lib/analytics.ts` (`captureServerEvent(userId, event, props)`) mirroring the lazy-init pattern of `app/lib/anthropic.ts`.
- `posthog.identify(user.id)` in `AuthProvider` when a user becomes known; `reset()` on sign-out (stitches anonymous browse → known user).
- **Client events (intent/UI):** `landing_viewed`, `explore_viewed`, `character_viewed`, `character_start_chat_clicked` + `start_chat_signup_wall_hit` (fired BEFORE the `CharacterStartChatButton.tsx:17` redirect — quantifies the #1 leak), `character_remix_clicked`, `upgrade_modal_viewed`/`upgrade_cta_clicked`.
- **Server events (source of truth):** `conversation_created` (`POST /api/conversations`), `first_message_sent` + `message_sent` (`POST /api/messages` and `/api/ai/chat-stream`), `ai_limit_reached` (`app/lib/ai-access.ts` denial path, carrying the denial code), `signup_completed` (Clerk `user.created` webhook), `subscription_started` (Stripe `checkout.session.completed`).
- **Attribution migration (additive, nullable):** `User.referralSource`, `utmSource`, `utmMedium`, `utmCampaign`, `referredById @db.Uuid` (self-relation), `firstTouchAt`. First-touch capture in `ClientShell` writes `utm_*`/`?ref` into a first-party cookie; persist on the Clerk `user.created` upsert via Clerk `publicMetadata` or a first-login server action (the webhook cannot read the visitor cookie directly).
- Configure the acquisition→activation funnel, D1/D7/D30 retention, and signup-by-source breakdown in the PostHog UI (config, not code).

**Schema:** additive nullable columns on `User` (above). No backfill.

**Key files:** `ClientShell.tsx`, `AuthProvider.tsx`, `CharacterStartChatButton.tsx`, `app/api/webhooks/clerk/route.ts`, `app/api/conversations/route.ts`, `app/api/messages/route.ts`, `app/api/ai/chat-stream/route.ts`, `app/lib/ai-access.ts`, `app/api/webhooks/stripe/route.ts`, `app/lib/analytics.ts` (new), `prisma/schema.prisma`, `env.mjs` + `.env.local.example`.

**Success metric:** live funnel in PostHog with >90% of server-truth signups appearing as `signup_completed`; >50% of new signups carry a non-null source within 2 weeks.

**Risks/mitigations:** ad-block event loss → reverse-proxy + server-side canonical events; `first_message_sent` double-count across `/api/messages` and `/api/ai/chat-stream` → gate on a cheap "is this the user's first message ever?" count, fire `message_sent` unconditionally; consent/GDPR on sensitive chat → EU Cloud, gate behind `CookieBanner`, **disable session replay inside `/dashboard/conversations`**, mask text inputs.

### Phase 1 — Indexability foundation _(effort: M)_

**Goal:** make 100% of public **SFW** UGC discoverable by crawlers, using pages that already render.

**Build:**

- Rewrite `app/sitemap.ts` to query `character.findMany({ where: { isPublic: true, isNsfw: false } })` → `/characters/{slug}`, distinct creators with ≥1 public SFW character → `/creators/{id}`, plus the static routes. **The `isNsfw:false` filter is load-bearing** (prevents serving `CharacterNsfwGate` soft-404s to crawlers and leaking AI-companion content). Weight priority via `app/lib/recommendations.ts` (call with empty signals). Add `generateSitemaps()` sharding before 50k URLs.
- Promote the `CHARACTER_SELECT` constant (currently duplicated across marketing `page.tsx`/`explore`/`feed`) into shared `app/lib/character-select.ts`, reused by the sitemap query.
- **JSON-LD:** add `application/ld+json` to `characters/[slug]/page.tsx` (`Product`/`CreativeWork` + `BreadcrumbList`; `aggregateRating` from `likeCount`, `InteractionCounter` from `usageCount`) and `Person`/`ProfilePage` to `creators/[userId]/page.tsx`.
- Add `alternates.canonical` to `generateMetadata` on `characters/[slug]`, `creators/[userId]`, `/feed` (only home/explore/pricing have it today).
- **Decouple view tracking from render, THEN switch `characters/[slug]` and `creators/[userId]` from `force-dynamic` to `revalidate`-based ISR.** The per-GET `viewCount` increment (`characters/[slug]/page.tsx` ≈ line 416) currently blocks caching and is bot-inflated — move it to a client beacon / separate route first. **This ordering is non-negotiable**: ISR before view-decoupling corrupts the `usageCount`/`viewCount` signals that P3/P4 social-proof and leaderboards depend on.

**Schema:** none required.

**Success metric:** ≥80% of eligible public SFW character/creator pages indexed in Google Search Console within 8 weeks; Search Console soft-404 count stays ~0 (validates the `isNsfw:false` filter).

### Phase 2 — Conversion fix + programmatic SEO pages _(effort: L)_

**Goal:** stop the #1 leak so P1's traffic converts; add head-term landing pages that funnel link equity into the catalog.

**Build:**

- **Guest try-before-signup:** replace the `CharacterStartChatButton.tsx:17` hard `/sign-in` redirect with a guest flow — ~5 messages via an anonymous cookie session against `POST /api/conversations`/`/api/messages`, **SFW-only** (reuse `canAccessNsfw=false`), on the free-tier (Haiku) model, **strictly per-IP rate-limited** via `app/lib/rate-limit.ts`. Trigger the existing `UpgradeModal.tsx` pattern as the "Sign up to keep chatting" wall.
- **Per-category programmatic pages:** new server route `app/(marketing)/explore/[category]/page.tsx` over the 10 `CHARACTER_CATEGORIES` (already have name/description/emoji): unique `<h1>` ("Anime AI Characters"), per-category title/description/canonical, `generateStaticParams` + `revalidate`, server-rendered `PublicCharacterCard` grid. This replaces the client-only `?category=` filter as the crawlable surface; add to sitemap.
- **Per-tag hubs:** `app/(marketing)/characters/tag/[slug]/page.tsx` over `Character.tags` (`tags: { has: tag }`) for ultra-long-tail intent. **Gate behind a minimum character count and write unique intro copy; `noindex` hubs below threshold** (avoid thin/doorway penalties).
- **Internal linking:** make the category badge + tag chips on `characters/[slug]` real `<Link>`s to the hubs (currently plain spans).
- 1–2 editorial high-intent pages (e.g. `/character-ai-alternatives`) with real copy + a live top-character grid.

**Schema:** none required (handles deferred — see §7).

**Success metric:** ≥30% of `start_chat` clicks send ≥1 guest message and ≥15% of those sign up; visitor→signup on character/category pages >2% (the gate for any P5 spend).

### Phase 3 — Share virality (OG cards + share button) _(effort: M)_

**Goal:** turn every shared character link into a high-CTR acquisition surface.

**Build:**

- Per-character dynamic OG image: `app/(marketing)/characters/[slug]/opengraph-image.tsx` cloning the edge `ImageResponse` in `app/opengraph-image.tsx` (gradient + name + tagline + avatar + `usageCount`/`likeCount` social proof). Wire `generateMetadata.openGraph.images` to it, replacing the raw-avatar OG.
- Per-creator OG card: `app/(marketing)/creators/[userId]/opengraph-image.tsx`.
- On-page `ShareCharacterButton` in `CharacterHero` (no public share entry point exists today): copies `/characters/{slug}?ref={handle}&utm_source={target}` with one-tap Reddit/X/Discord/TikTok-copy targets, reusing the clipboard+toast pattern from `app/components/sharing/ShareLinkCopy.tsx`. A plain `?ref` param (not the login-gated `ConversationShare` token engine) keeps the link crawler-safe.

**Schema:** optional `Character.shareCount Int @default(0)`.

**Success metric:** share-link CTR measurably higher than the raw-avatar baseline; rising share→click→signup attribution coverage.

### Phase 4 — Creator supply flywheel _(effort: L)_

**Goal:** make creators (and any sharer) the distribution channel by crediting the signups their links drive and rewarding it with status — without un-shippable rev-share.

**Build:**

- **Schema (additive, mirroring `AffiliateClick`):** `User.referralCode @unique` (keyword handle via `app/lib/slug.ts`); `ReferralClick { code, characterId?, creatorId, source, ua, ip, createdAt }`; `ReferralAttribution { userId @unique (credited first-touch signup), creatorId, characterId?, code, source }`; optional denormalized `User.referredSignupCount` for cheap leaderboard reads.
- Capture `?ref`/`?via` + `utm_*` into the first-party cookie in `middleware.ts` (edge-safe, no Prisma — the only place that sees the logged-out visitor). Resolve to a `ReferralAttribution` row on the first **authenticated** request in `getCurrentUser()` or `POST /api/conversations` (NOT the Clerk webhook). Guard self-referral (`creatorId !== signup userId`).
- Creator + character leaderboards at `app/(marketing)/explore/leaderboard/page.tsx`: rank by referred signups + 30-day `usageCount` delta + `likeCount` + followers, reusing `recommendations.ts`. Add a recency-weighted "trending now" signal (current trending uses lifetime `usageCount`, favoring old characters). Server-rendered → also an SEO + sitemap page. Gate behind a volume threshold so it isn't empty at cold-start.
- **Recognition incentive ladder (shippable now):** badges (Verified/Rising/Top Creator) on `PublicCharacterCard` + creator pages, leaderboard pins, featured-rotation slots, and PRO comps via existing subscription plumbing — **tiered on ACTIVATED referred signups (sent ≥1 message), not raw registrations.** Do **not** market earnings.
- Creator dashboard "Promote" panel: pre-filled Reddit/X/Discord/TikTok copy with the attributed `?ref` link + OG thumbnail + a live "signups you referred" counter (clone `/api/affiliate/summary`).

**Success metric:** % of signups that are attributed (k-factor proxy) trending up; a cohort that earned a badge/PRO comp shares more in the next 30 days than non-earners; referred signups show comparable or better D7 activation vs organic.

**Anti-fraud baked in:** `ReferralAttribution.userId @unique` (one credit/user), block `creatorId == signupId`, IP-rate-limit `ReferralClick` (reuse `getClientIdentifier`), activation-gated perks.

### Phase 5 — Capped paid measurement experiment _(effort: M)_ — **LAST, kill-gated**

**Goal:** measure per-channel CAC on policy-tolerant channels — explicitly **not** to scale.

**Build:**

- **Hard gate:** only after P0–P4 ship AND organic visitor→signup >2%. Total spend capped **$300–500**, one channel at a time at $50–100.
- Channel priority by AI-companion policy fit: **Reddit Ads** (most permissive) > **Google Search** ("character ai alternative", strictly SFW copy) > **X**. **Explicitly avoid TikTok and Meta** (both ban AI-companion/"virtual relationship" creative; accounts get permanently flagged). Frame all creative as "creative writing / interactive fiction", never "companion/relationship". Any paid landing/OG card hard-filters `isNsfw:false`.
- UTM-tagged landing variants → best P2 category page or a top SFW character; signups attributed via P0 capture.
- Internal allowlisted `/dashboard/admin/growth` view joining `ReferralClick`/`utmSource` → User signups → Stripe status to compute per-channel CAC, free→PRO conversion, and months-to-payback (CAC / $9.99 gross − Anthropic token COGS). **Kill any channel >12-month payback.**

**Success metric:** a defensible per-channel CAC + a clear keep/kill decision. A kill decision is a successful outcome.

---

## 6. Metrics framework

- **North star:** Weekly Activated Users — distinct users who send ≥3 messages in a rolling 7-day window (core companion-chat value, not vanity signups). Built from server-side `message_sent`.
- **Inputs:** visitor→signup conversion (segmented by source); indexed-page coverage; guest-try activation; attribution coverage / k-factor proxy; share-link CTR.
- **Guardrails:** free→PRO conversion; Search Console soft-404 count (catches NSFW leaking into crawl surfaces); `ai_limit_reached` rate among activated users (50-msg free cap throttling activation); event-loss / consent-opt-out rate; guest-chat token spend per non-converting IP (bot abuse).

## 7. Open decisions — proposed defaults (confirm during review)

1. **Guest-try scope:** default **5 free messages** before the wall, free-tier (Haiku) model, SFW-only, per-IP limit via a dedicated guest limiter (e.g. ≤5 messages/conversation, ≤20/hour/IP). Trades activation lift vs token burn.
2. **PRO-comp economics:** default tier — **10 activated referred signups → 30 days PRO comped** via `stripeCurrentPeriodEnd` grant (no paid Stripe sub). _Requires confirming a clean "grant PRO for N days" helper exists; if not, building it is part of P4._ Monthly comp budget cap TBD by founder.
3. **Creator-handle URLs:** **defer** `User.username/handle` (keyword `/creators/[handle]` URLs) to P4; ship UUID creator URLs through P1–P3 to avoid a backfill migration + id→handle redirects now.
4. **PostHog residency:** **EU Cloud**, autocapture behind consent, **session replay disabled inside `/dashboard/conversations`**, all text inputs masked.
5. **Rev-share:** **deferred / out of scope.** Message "earn recognition + PRO perks" only. Stripe Connect (Express) payouts + 1099/KYC are a separate future workstream.
6. **Cold-start thresholds:** category/tag hubs `noindex` below **8** public SFW characters; public leaderboard hidden below a volume threshold (default ≥25 eligible creators); landing/pricing social-proof numbers hidden until real data exists (reuse the existing graceful-degrade-to-`starterArchetypes` pattern).
7. **Paid budget + go/no-go:** confirm the **$300–500 cap**, the **>2% organic-conversion gate**, and that the goal is a CAC measurement (kill decision acceptable, not quietly scaled).

## 8. First two weeks (highest-leverage starts)

1. Wire PostHog (client + reverse-proxy + `identify`/`reset`) — live pageviews/replay/identity in ~half a day.
2. Instrument `character_start_chat_clicked` + `start_chat_signup_wall_hit` before `CharacterStartChatButton.tsx:17` — quantify the #1 leak immediately.
3. Add server-side `signup_completed` (Clerk webhook) + `subscription_started` (Stripe) via `posthog-node`.
4. Ship the additive `User` attribution migration + first-touch cookie capture + webhook persistence.
5. Rewrite `app/sitemap.ts` to be Prisma-backed (SFW filter) — unlocks indexing of 100% of UGC.
6. Add JSON-LD + canonicals to character/creator/feed pages.
7. Clone the per-character OG card — upgrades CTR of every link already being shared.
8. Verify Search Console + Bing property and submit the new sitemap (operational).
9. Stand up the acquisition→activation funnel + retention insight in PostHog (no code).

## 9. Out of scope / deferred

- Stripe Connect creator payouts / rev-share (separate workstream; gated off today via `enableCreatorPayments`).
- Any TikTok/Meta paid creative for companion content.
- Keyword creator handles until P4.
- Mobile apps, new chat features — this program is acquisition plumbing, not product surface area.

## 10. How phases map to implementation

Each phase is an independent implementation plan (its own `executing-plans` cycle). **Dependency order is strict for P0 → P1 → P2**; P3 depends on P1 (the indexed page is the share target); P4 depends on P0 (attribution columns/cookie), P1 (clean `usageCount`), and P3 (OG cards + share button); P5 depends on all prior phases plus the >2% conversion gate. The first implementation plan covers **P0 + P1** (the foundation that unblocks and de-risks everything else).
