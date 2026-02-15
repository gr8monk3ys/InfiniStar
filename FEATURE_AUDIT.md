# Feature Audit (Character.AI / Joyland Comparison)

This is a pragmatic, code-informed snapshot of product parity against typical Character.AI/Joyland feature sets. It is **not exhaustive** and should be validated against current product behavior (including Vercel env + DB state).

Legend: **Implemented**, **Partial**, **Missing**

## Core Chat Experience

- **AI 1:1 chat**: Implemented
- **Streaming responses (SSE)**: Implemented
- **Multiple AI models + routing (free vs PRO)**: Implemented (Claude Haiku/Sonnet/Opus)
- **Personality presets + custom system prompt**: Implemented (7 presets + custom)
- **Image attachments**: Implemented (Cloudinary upload)
- **Multimodal image input to AI (vision)**: Implemented (image URL sent to Claude)
- **Voice input**: Implemented (Web Speech API; browser-dependent)
- **Voice output / TTS**: Implemented (browser `speechSynthesis` for AI messages)
- **Conversation search**: Implemented
- **Tags / organization**: Implemented
- **Conversation share links / join flow**: Implemented (verify UX)
- **Conversation export (MD/JSON/TXT)**: Implemented
- **Threaded replies (reply-to)**: Implemented
- **Regenerate AI replies**: Implemented (overwrites message; no “deleted placeholder” UX)
- **Message reactions**: Implemented
- **Message edits (user messages)**: Implemented
- **Conversation branching / alt replies UI**: Missing

## Characters / Marketplace

- **Character creation & editor**: Implemented (`/dashboard/characters`)
- **Public character pages**: Implemented (`/characters/[slug]`)
- **Explore / discovery**: Implemented (`/explore` + API sorting)
- **Trending / featured**: Implemented (featured flag + usage/like sorting)
- **Likes + favorites**: Implemented (`/dashboard/favorites`)
- **Character remix/clone**: Implemented (Remix button clones a public character into your library)
- **Creator profiles**: Implemented (`/creators/[userId]`)
- **Follow creators + following feed**: Implemented (`/feed`)

## Memory & Long-Term Context

- **Persistent memory store**: Implemented (DB-backed memories per user)
- **Memory injected into AI system prompt**: Implemented
- **Manual memory CRUD UI**: Implemented (Profile Settings -> AI Memory)
- **Auto-extract memories from conversations**: Partial (API exists; not integrated into the main chat UX)
- **Per-conversation memory controls (pin/forget)**: Missing

## Safety & Moderation

- **Basic text moderation (block/review)**: Partial (rule-based; should be upgraded to model-assisted moderation for scale)
- **User reporting + moderation reports endpoints**: Implemented
- **User blocking**: Implemented
- **Age gating / NSFW policy controls**: Missing

## Social / Community

- **Community feed**: Implemented (top creators, trending, following)
- **Community comments / posts**: Missing
- **Public profile “social graph” polish (badges, leaderboards, etc.)**: Missing

## Payments / Monetization

- **Subscriptions (Stripe PRO)**: Implemented
- **AI usage tracking + usage dashboard**: Implemented
- **Affiliate links**: Implemented
- **AdSense unit(s)**: Implemented (verify config + policy compliance)
- **Creator monetization (tips + subscriptions)**: Implemented (verify Stripe setup)

## Ops / Reliability

- **CSRF protection**: Implemented
- **Rate limiting**: Implemented (Redis-backed optional)
- **PWA manifest + installability**: Implemented
- **Browser notifications (foreground / best-effort)**: Implemented
- **True web push notifications (background)**: Missing

## Highest-Priority Gaps For Competitive Parity

- Conversation branching / alternate replies selection UI
- Stronger safety (model-based moderation, age gating, better reporting UX)
- True web push notifications (service worker + VAPID + server fanout)
- Audio messages + transcription
- Image generation (provider integration + cost controls)
