# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: adults who enjoy immersive character roleplay and ongoing companion
conversations — anime heroes, fantasy companions, original personalities. The
Character.ai-style audience. Typical moment: leisure time, often on a phone,
returning to a character they already have a relationship with.

Secondary (confirmed as a real audience, not the lead): creators who build and
publish characters and can earn from them through follows, tips, and paid
subscriptions.

## Product Purpose

InfiniStar lets people chat with AI characters that stay in character over
long relationships, and lets creators publish characters others can find and
support. Success is a chatter who comes back to the same characters week after
week, and a creator whose characters earn an audience.

Live at https://infinistar.app (Vercel). Private repo, one-person team.

## Positioning

Three claims the owner stands behind (confirmed 2026-09-01):

1. **Better conversations.** Runs on Claude. Character prompts include scenario
   and example dialogues; system prompts are cached so long roleplays stay
   affordable; auto memory extraction keeps continuity across sessions.
2. **Creator earnings.** Characters carry followers, tips, and paid creator
   subscriptions — a creator flywheel, not just a chat toy.
3. **Memory and personas.** Persistent per-character memory, user personas
   (who _you_ are in the story), scenarios, and conversation summaries make
   relationships that accumulate rather than reset.

Named competitors: Character.ai, Janitor AI.

## Operating Context

- Discovery surfaces: `/explore` (browse by tag/category) and `/feed`; character
  pages at `/characters/[slug]`, creator profiles; marketing home and
  `/pricing`.
- Dashboard: conversations (streaming chat, regenerate, reactions, templates),
  character creation and remixing, personas, memory manager, sharing links,
  settings, profile.
- Real-time presence and messaging via Pusher; push notifications and a service
  worker exist.
- Growth model is supply-driven organic (indexable character and creator pages,
  sitemap, JSON-LD, PostHog attribution), $0 ad budget. Phases still unbuilt
  as of 2026-09: guest-try, share OG cards, creator flywheel polish, capped
  paid.

## Capabilities and Constraints

- Tiers: **Free** — 50 AI messages per month (`AI_FREE_MONTHLY_MESSAGE_LIMIT`),
  and **PRO** via Stripe with higher limits and faster/deeper model access.
- Auth is Clerk; a fallback cookie auth path exists but stays off.
- Moderation: content reports, user blocks, safety preferences.
- **Mature content is age-gated opt-in.** `nsfwEnabled` on User is a real
  product decision: allowed for verified adults who explicitly enable it,
  default off. Surfaces must respect the toggle; nothing mature leaks to
  logged-out or default users.
- Terminology: _character_ (published persona with scenario and example
  dialogues), _creator_ (user who publishes characters), _persona_ (the
  user's own identity in a chat), _memory_ (extracted facts kept per
  character), _remix_ (fork of a character), _scene_ (multi-character chat).
- Roadmap ideas not yet built (do not present as features): character card
  import/export (V2/SillyTavern), lorebooks, generated character portraits,
  persona selector in conversation creation.
- Actions minutes are capped; nothing heavy runs in CI beyond lint,
  typecheck, test, build.

## Brand Commitments

- Name: **InfiniStar**. Domain infinistar.app. Support: support@infinistar.app.
- Tagline in use: "Chat with anime heroes, fantasy companions, and creative AI
  personalities. Powered by Claude."
- Binding visual constraints already decided by the owner (recorded, not
  expanded here): fonts are self-hosted from `app/fonts/` with no network
  fetch at build time; the shipped identity (violet primary, aurora gradient,
  Bricolage Grotesque headings) landed in PR #50 on 2026-07-28 and is
  documented in `DESIGN.md`. An earlier warm-rose rebrand (PR #39) was closed
  unmerged and is not the incumbent.
- Voice as shipped: direct, warm, plain; no hype.

## Evidence on Hand

- **No real testimonials, user counts, press, or case studies exist.** Never
  invent them, and never use placeholder social proof.
- Real assets: favicons and app icons in `public/`; a home screenshot at
  `docs/screenshots/home.png`; the app itself is live for screenshots.
- Real product facts that can be shown truthfully: the free limit, the two
  tiers, Claude as the model, persistent memory and personas, creator tips
  and subscriptions.

## Product Principles

1. **Relationships over sessions.** Every surface should make it easy to
   return to an existing character, not just start a new one.
2. **Character first, interface second.** The character's voice and world
   carry the experience; UI stays quiet and consistent.
3. **Creators are a real audience.** Publishing, earnings, and discovery are
   product, not afterthoughts.
4. **Truthful by construction.** Only claim what ships; only cite evidence
   that exists; mature content stays behind the opt-in.
5. **Warm, not generic-AI.** Differentiate from cold productivity-AI patterns
   in tone and identity; the details are the brand.

## Accessibility & Inclusion

No product-specific standard has been set. Existing UI uses semantic tokens
with WCAG AA-checked contrast on primary CTAs and gradients. Long reading and
typing sessions on phones are the core use; legibility and touch targets
matter more than density.
