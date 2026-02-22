# Production Hardening Design

**Date:** 2026-02-22
**Status:** Approved
**Approach:** Sequential sprints (A)

## Context

Assessment identified three categories of issues blocking production readiness. This document covers the agreed design for all three phases.

---

## Phase 1 — Quick Wins

### 1. CSP Hardening

Remove `*.lscaturchio.xyz` from `script-src` in `next.config.mjs`. This is a developer personal domain that has no place in the production CSP. One line deletion, no functional impact.

### 2. Migrations Workflow

Add `prisma migrate deploy` to the production deployment path. Dev workflow stays `prisma db push`. Production uses `migrate deploy` so schema changes are tracked and reversible. Document in `package.json` scripts and `CLAUDE.md`.

### 3. axios → API Client in Form.tsx

Replace 3 `axios.post()` calls in `Form.tsx` with `api.post()` from `app/lib/api-client.ts`:

- `POST /api/ai/chat` (non-streaming fallback)
- `POST /api/messages` (regular message send)
- `POST /api/messages` (image upload via Cloudinary callback)

Gets retry logic, exponential backoff, and consistent error handling. Removes the `axios` import from this file.

---

## Phase 2 — Component Refactors

### Form.tsx (890 lines → ~150 lines)

Split into focused units:

| New file                 | Responsibility                                                     |
| ------------------------ | ------------------------------------------------------------------ |
| `useMessageSubmit.ts`    | Submit callback, streaming/non-streaming branching, error handling |
| `ImageUploadButton.tsx`  | Cloudinary upload widget, pending image state                      |
| `VoiceMessageButton.tsx` | Voice recording trigger and state                                  |
| `SuggestionBar.tsx`      | Suggestion chips + preference toggle                               |
| `Form.tsx`               | Thin orchestrator composing the above (~150 lines)                 |

`MessageInput.tsx` already exists and stays as-is.

### profile/page.tsx (687 lines → ~80 lines)

Tab components already exist in `profile/components/`. The page currently contains logic that belongs in those components. Refactor to delegate fully to tab components; page becomes layout + routing only.

---

## Phase 3 — NSFW Age Gate

### Problem

`isAdult` is currently a boolean set via the safety preferences API with no verification. Any user can set it to `true` directly. This is legally insufficient in most jurisdictions.

### Solution

Replace with a proper age gate consent flow:

**New schema fields on `User`:**

- `ageVerifiedAt` — DateTime, null until user passes gate
- `ageVerificationVersion` — String, tracks which ToS version was accepted (enables re-prompting on policy changes)

**Age gate modal:**

- Triggered when user first enables NSFW or visits an NSFW character without prior consent
- Requires explicit confirmation of: 18+ age, acceptance of content ToS, acknowledgment of content policy
- On confirm: sets `ageVerifiedAt` + `ageVerificationVersion`, then sets `nsfwEnabled: true`
- On dismiss: NSFW content blocked, preference not saved

**API enforcement:**

- `PATCH /api/safety/preferences` can only set `nsfwEnabled: true` if `ageVerifiedAt` is non-null
- If `ageVerifiedAt` is null but `nsfwEnabled` is somehow true (data inconsistency), treat as unverified
- `canAccessNsfw()` in `app/lib/nsfw.ts` updated to also check `ageVerifiedAt`

**Scope decision:** No ID verification. For an AI chatbot, logged-in user attestation + ToS acceptance is the standard in this space (Character.ai, Janitor.ai, etc.). ID verification is Pornhub-tier compliance overhead not applicable here.

---

## Success Criteria

- [ ] Phase 1: No `axios` import in `Form.tsx`, no `lscaturchio.xyz` in CSP, `migrate:deploy` script exists
- [ ] Phase 2: No file in the Form component tree exceeds 250 lines, all existing behavior preserved
- [ ] Phase 3: `nsfwEnabled` cannot be set to `true` without `ageVerifiedAt` being set, gate modal shown on first NSFW access
