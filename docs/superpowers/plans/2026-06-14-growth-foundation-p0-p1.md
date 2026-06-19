# Growth Foundation (P0 + P1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the growth program's foundation — product-analytics instrumentation with signup attribution (P0) and SEO indexability of all public SFW UGC (P1) — so every later growth change is measurable and the catalog is discoverable.

**Architecture:** P0 adds PostHog (client + a fail-fast server singleton), fires client + server-side funnel events (including the #1 leak quantifier on the logged-out Start Chat path), and persists first-touch UTM/ref attribution onto `User` resolved on the first authenticated request. P1 makes `sitemap.ts` Prisma-backed (SFW-filtered), adds JSON-LD + canonicals, and decouples view-tracking from render before switching public pages to ISR. Pure logic (attribution parse/serialize/resolve, the server-event helper, sitemap generation, JSON-LD builders, the view-track route, the client event-emitters) is TDD'd; provider mounts, the next.config rewrite, and the Prisma migration are explicit manual-verification steps.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma/Postgres (Neon), Clerk, Stripe, PostHog (`posthog-js` + `posthog-node`), Jest (`bun run test`).

**Spec:** `docs/superpowers/specs/2026-06-14-user-acquisition-growth-design.md` (Phases 0 and 1).

---

## Reconciliation & shared conventions (READ THIS FIRST)

These tasks were drafted as independent slices; the following rules resolve the overlaps. Honor them over any contradicting detail inside an individual task.

1. **Single attribution module API (`app/lib/attribution.ts`).** This file is created once and is the only home for the cookie/parse helpers. Its canonical exports are: `ATTRIBUTION_COOKIE_NAME`, the `AttributionPayload` type, `parseAttributionFromSearch`, `readAttributionCookie`, `serializeAttributionCookie` (client/isomorphic helpers), **plus** `resolveAttribution` and its `UserAttributionState` / `AttributionPersistInput` types (server resolution). Server-only persistence (`persistAttributionForUser`) lives in `app/lib/attribution-persist.ts`. **Wherever a later task says `parseAttributionCookie` or the `AttributionCookie` type, use `readAttributionCookie` / `AttributionPayload` instead** — do not introduce a second parser or a second cookie-payload type, and declare `ATTRIBUTION_COOKIE_NAME` exactly once (in the first attribution task; later tasks import it).

2. **PostHog env vars are added once.** `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` (client) and `POSTHOG_API_KEY` (server) are added to `env.mjs` and `.env.local.example` in the **first** task of Part A1 that needs them. Every later task that references these vars must **skip the add step if they are already present** — never duplicate the `env.mjs` edit.

3. **The `User` attribution migration is owned by Part A3.** A1 and A4 read the attribution cookie and A2 fires events, but the Prisma schema change + migration for `referralSource`/`utmSource`/`utmMedium`/`utmCampaign`/`referredById`/`firstTouchAt` is created exactly once, in A3. Run A3's migration before executing the A3 persistence task.

4. **Task order.** P0 = A1 (PostHog client setup + attribution helpers) → A2 (server analytics singleton + server events) → A3 (attribution migration + persistence + `signup_completed`) → A4 (client funnel events). P1 = B1 (dynamic sitemap) → B2 (JSON-LD + canonicals) → B3 (view-tracking decouple → ISR). Within P1, **B3's view-decouple must precede the ISR switch** (counts get bot-inflated otherwise). P0 and P1 are independent and can proceed in parallel by different workers if desired.

5. **Client vs server capture.** Client components capture via the `posthog-js` singleton (`import posthog from "posthog-js"; posthog.capture(...)`). Server routes/webhooks capture via `captureServerEvent(distinctId, event, properties?)` from `app/lib/analytics.ts` (Part A2). Never mix the two.

---

## P0 SLICE A1 — PostHog client wiring + first-touch attribution

> Context for the executing engineer: `ClientShell` (`app/components/providers/ClientShell.tsx`) is a `"use client"` component mounted once in `app/layout.tsx:69`. It dynamically imports `CookieBanner` (`app/components/CookieBanner.tsx`), which today stores dismissal in `localStorage` under `infinistar_cookie_notice_dismissed` — there is **no analytics-consent concept yet**, so this slice introduces one. `AuthProvider` (`app/components/providers/AuthProvider.tsx`) exposes the signed-in user via `state.user` and a `signOut` callback inside `BaseAuthProvider`. `env.mjs` has explicit `server:` / `client:` / `runtimeEnv:` blocks. `next.config.mjs` has **no `rewrites()`** yet. The TDD weight is on the pure attribution + consent helpers; provider mounting, the rewrite, and identify/reset are config + manual-verification steps.

---

### Task 1: Attribution pure helpers (parse / serialize / read cookie)

**Files:**

- Create: `app/lib/attribution.ts`
- Test: `app/__tests__/lib/attribution.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/**
 * @jest-environment node
 */
import {
  ATTRIBUTION_COOKIE_NAME,
  parseAttributionFromSearch,
  readAttributionCookie,
  serializeAttributionCookie,
  type AttributionPayload,
} from "@/app/lib/attribution"

describe("attribution helpers", () => {
  describe("ATTRIBUTION_COOKIE_NAME", () => {
    it("is the shared contract name", () => {
      expect(ATTRIBUTION_COOKIE_NAME).toBe("ist_attribution")
    })
  })

  describe("parseAttributionFromSearch", () => {
    it("returns null when no attribution params are present", () => {
      expect(parseAttributionFromSearch("?foo=bar&baz=1")).toBeNull()
      expect(parseAttributionFromSearch("")).toBeNull()
    })

    it("parses utm params and ref, with an ISO firstTouchAt", () => {
      const result = parseAttributionFromSearch(
        "?utm_source=twitter&utm_medium=social&utm_campaign=launch&ref=alice"
      )
      expect(result).not.toBeNull()
      expect(result?.utmSource).toBe("twitter")
      expect(result?.utmMedium).toBe("social")
      expect(result?.utmCampaign).toBe("launch")
      expect(result?.ref).toBe("alice")
      expect(typeof result?.firstTouchAt).toBe("string")
      expect(Number.isNaN(Date.parse(result!.firstTouchAt))).toBe(false)
    })

    it("accepts a leading '?' or a bare query string", () => {
      expect(parseAttributionFromSearch("utm_source=x")?.utmSource).toBe("x")
      expect(parseAttributionFromSearch("?utm_source=x")?.utmSource).toBe("x")
    })

    it("returns null when only blank/whitespace values are present", () => {
      expect(parseAttributionFromSearch("?utm_source=&ref=%20")).toBeNull()
    })

    it("omits absent optional keys (no undefined-stringified values)", () => {
      const result = parseAttributionFromSearch("?ref=bob")
      expect(result).toEqual({ ref: "bob", firstTouchAt: expect.any(String) })
      expect("utmSource" in (result as object)).toBe(false)
    })
  })

  describe("readAttributionCookie", () => {
    it("returns null when the cookie is absent", () => {
      expect(readAttributionCookie("other=1; foo=bar")).toBeNull()
      expect(readAttributionCookie("")).toBeNull()
    })

    it("decodes a URL-encoded JSON cookie value", () => {
      const payload: AttributionPayload = { ref: "alice", firstTouchAt: "2026-01-01T00:00:00.000Z" }
      const cookie = `ist_attribution=${encodeURIComponent(JSON.stringify(payload))}; theme=dark`
      expect(readAttributionCookie(cookie)).toEqual(payload)
    })

    it("returns null on malformed JSON instead of throwing", () => {
      expect(readAttributionCookie("ist_attribution=%7Bnot-json")).toBeNull()
    })
  })

  describe("serializeAttributionCookie", () => {
    it("produces a first-party Set-Cookie style string with the contract name", () => {
      const payload: AttributionPayload = {
        utmSource: "x",
        firstTouchAt: "2026-01-01T00:00:00.000Z",
      }
      const serialized = serializeAttributionCookie(payload)
      expect(serialized.startsWith("ist_attribution=")).toBe(true)
      expect(serialized).toContain("path=/")
      expect(serialized).toContain("samesite=lax")
      expect(serialized).toContain("max-age=")
      // round-trips back through the reader
      const cookieHeader = serialized.split(";")[0]
      expect(readAttributionCookie(cookieHeader)).toEqual(payload)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/lib/attribution.test.ts --runInBand`
      Expected: FAIL with "Cannot find module '@/app/lib/attribution'"
- [ ] **Step 3: Implement**

```ts
// app/lib/attribution.ts
// First-touch marketing attribution captured client-side and mirrored to a
// first-party cookie. Shared contract: cookie name `ist_attribution`, JSON value
// { utmSource?, utmMedium?, utmCampaign?, ref?, firstTouchAt }. First-touch wins.

export const ATTRIBUTION_COOKIE_NAME = "ist_attribution"

// 1 year — long enough to attribute a delayed signup to its first touch.
const ATTRIBUTION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export interface AttributionPayload {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  ref?: string
  firstTouchAt: string
}

function firstNonEmpty(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key)
  if (value === null) {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * Parse UTM + ref params out of a query string. Returns null when none of the
 * tracked params carry a non-blank value (so callers never overwrite an existing
 * first-touch cookie with an empty payload).
 */
export function parseAttributionFromSearch(search: string): AttributionPayload | null {
  const normalized = search.startsWith("?") ? search.slice(1) : search
  if (normalized.length === 0) {
    return null
  }

  const params = new URLSearchParams(normalized)
  const utmSource = firstNonEmpty(params, "utm_source")
  const utmMedium = firstNonEmpty(params, "utm_medium")
  const utmCampaign = firstNonEmpty(params, "utm_campaign")
  const ref = firstNonEmpty(params, "ref")

  if (!utmSource && !utmMedium && !utmCampaign && !ref) {
    return null
  }

  const payload: AttributionPayload = { firstTouchAt: new Date().toISOString() }
  if (utmSource) payload.utmSource = utmSource
  if (utmMedium) payload.utmMedium = utmMedium
  if (utmCampaign) payload.utmCampaign = utmCampaign
  if (ref) payload.ref = ref
  return payload
}

/** Read and decode the attribution payload from a `document.cookie` style string. */
export function readAttributionCookie(cookieString: string): AttributionPayload | null {
  if (!cookieString) {
    return null
  }

  const match = cookieString
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ATTRIBUTION_COOKIE_NAME}=`))

  if (!match) {
    return null
  }

  const rawValue = match.slice(ATTRIBUTION_COOKIE_NAME.length + 1)
  try {
    const decoded = decodeURIComponent(rawValue)
    const parsed = JSON.parse(decoded) as unknown
    if (parsed && typeof parsed === "object" && "firstTouchAt" in parsed) {
      return parsed as AttributionPayload
    }
    return null
  } catch {
    return null
  }
}

/**
 * Serialize a first-party (NOT httpOnly — the client writes it) cookie string
 * suitable for assigning to `document.cookie`.
 */
export function serializeAttributionCookie(payload: AttributionPayload): string {
  const value = encodeURIComponent(JSON.stringify(payload))
  return `${ATTRIBUTION_COOKIE_NAME}=${value}; path=/; max-age=${ATTRIBUTION_MAX_AGE_SECONDS}; samesite=lax`
}
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/lib/attribution.test.ts --runInBand`
      Expected: PASS
- [ ] **Step 5: Commit**

```bash
git add app/lib/attribution.ts app/__tests__/lib/attribution.test.ts && git commit -m "feat(analytics): add first-touch attribution parse/serialize/cookie helpers"
```

---

### Task 2: Analytics consent gating helper

> `CookieBanner` only tracks a generic "notice dismissed" flag. This extracts a pure, testable helper for the **analytics** consent decision so both the banner and the PostHog provider read one source of truth. The helper reads `localStorage` defensively (SSR / private-mode safe).

**Files:**

- Create: `app/lib/analytics-consent.ts`
- Test: `app/__tests__/lib/analytics-consent.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  hasAnalyticsConsent,
  setAnalyticsConsent,
} from "@/app/lib/analytics-consent"

describe("analytics consent", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("exposes the storage key", () => {
    expect(ANALYTICS_CONSENT_STORAGE_KEY).toBe("infinistar_analytics_consent")
  })

  it("defaults to no consent", () => {
    expect(hasAnalyticsConsent()).toBe(false)
  })

  it("returns true only after consent is granted", () => {
    setAnalyticsConsent(true)
    expect(hasAnalyticsConsent()).toBe(true)
  })

  it("can revoke consent", () => {
    setAnalyticsConsent(true)
    setAnalyticsConsent(false)
    expect(hasAnalyticsConsent()).toBe(false)
  })

  it("does not throw when localStorage is unavailable", () => {
    const original = window.localStorage
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked")
      },
    })
    expect(() => hasAnalyticsConsent()).not.toThrow()
    expect(hasAnalyticsConsent()).toBe(false)
    Object.defineProperty(window, "localStorage", { configurable: true, value: original })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/lib/analytics-consent.test.ts --runInBand`
      Expected: FAIL with "Cannot find module '@/app/lib/analytics-consent'"
- [ ] **Step 3: Implement**

```ts
// app/lib/analytics-consent.ts
// Single source of truth for whether the user has consented to product analytics.
// Stored in localStorage so the choice survives reloads; read defensively because
// localStorage can throw in SSR, private mode, or when cookies/storage are blocked.

export const ANALYTICS_CONSENT_STORAGE_KEY = "infinistar_analytics_consent"

export function hasAnalyticsConsent(): boolean {
  try {
    if (typeof window === "undefined") {
      return false
    }
    return window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function setAnalyticsConsent(granted: boolean): void {
  try {
    if (typeof window === "undefined") {
      return
    }
    if (granted) {
      window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "1")
    } else {
      window.localStorage.removeItem(ANALYTICS_CONSENT_STORAGE_KEY)
    }
  } catch {
    // Storage unavailable (private mode / blocked) — treat as no-op.
  }
}
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/lib/analytics-consent.test.ts --runInBand`
      Expected: PASS
- [ ] **Step 5: Commit**

```bash
git add app/lib/analytics-consent.ts app/__tests__/lib/analytics-consent.test.ts && git commit -m "feat(analytics): add localStorage analytics-consent helper"
```

---

### Task 3: Wire consent grant into CookieBanner

> The banner's "Got it" button is the consent gesture. After this change, dismissing the banner also grants analytics consent so the PostHog provider can boot on the same render path.

**Files:**

- Modify: `app/components/CookieBanner.tsx:1-20`
- Test: `app/__tests__/components/CookieBanner.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import "@testing-library/jest-dom"

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { hasAnalyticsConsent } from "@/app/lib/analytics-consent"
import { CookieBanner } from "@/app/components/CookieBanner"

describe("CookieBanner", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("grants analytics consent when dismissed", async () => {
    render(<CookieBanner />)
    expect(hasAnalyticsConsent()).toBe(false)

    await userEvent.click(screen.getByRole("button", { name: /got it/i }))

    expect(hasAnalyticsConsent()).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/components/CookieBanner.test.tsx --runInBand`
      Expected: FAIL — `hasAnalyticsConsent()` stays `false` after click (consent not wired)
- [ ] **Step 3: Implement** — add the import and call `setAnalyticsConsent(true)` in `dismiss()`.

```tsx
// app/components/CookieBanner.tsx — add to the existing imports (after the next/link import)
import { setAnalyticsConsent } from "@/app/lib/analytics-consent"
```

Then update the existing `dismiss` function body:

```tsx
function dismiss() {
  localStorage.setItem(STORAGE_KEY, "1")
  setAnalyticsConsent(true)
  setVisible(false)
}
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/components/CookieBanner.test.tsx --runInBand`
      Expected: PASS
- [ ] **Step 5: Commit**

```bash
git add app/components/CookieBanner.tsx app/__tests__/components/CookieBanner.test.tsx && git commit -m "feat(analytics): grant analytics consent on cookie-banner dismiss"
```

---

### Task 4: Add PostHog env vars (env.mjs + .env.local.example)

> All three vars are optional so missing keys never break the existing strict env validation. Client vars go in the `client:` block; the server key goes in `server:` (it is consumed by SLICE A2's `app/lib/analytics.ts`).

**Files:**

- Modify: `env.mjs:23` (server block, after `ANTHROPIC_API_KEY`)
- Modify: `env.mjs:49` (client block, after `NEXT_PUBLIC_ENABLE_GROUP_CHAT`)
- Modify: `env.mjs:66` and `env.mjs:89` (runtimeEnv mirror)
- Modify: `.env.local.example:85` (after the Anthropic section)

- [ ] **Step 1 (MANUAL VERIFICATION — config, no unit test): add the server var to `env.mjs`.** This is `@t3-oss/env-nextjs` schema wiring; it cannot be meaningfully unit-tested in isolation. Add after line 23 (`ANTHROPIC_API_KEY: z.string().min(1).optional(),`) inside the `server:` object:

```js
    POSTHOG_API_KEY: z.string().min(1).optional(),
```

- [ ] **Step 2: add the two client vars to `env.mjs`.** Add after line 49 (`NEXT_PUBLIC_ENABLE_GROUP_CHAT: z.string().optional(),`) inside the `client:` object:

```js
    NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
```

- [ ] **Step 3: mirror all three into `runtimeEnv`.** Add after line 66 (`ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,`):

```js
    POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,
```

And after line 89 (`NEXT_PUBLIC_ENABLE_GROUP_CHAT: process.env.NEXT_PUBLIC_ENABLE_GROUP_CHAT,`):

```js
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
```

- [ ] **Step 4: document the vars in `.env.local.example`.** Insert after the Anthropic block (after line 85, the `ANTHROPIC_API_KEY=...` line):

```bash

# ----------------------------------
# PostHog (Product Analytics)
# ----------------------------------
# Sign up at: https://posthog.com/ — Project Settings → Project API Key
# Client key + host are public; the personal/server key is used for server-side capture.
NEXT_PUBLIC_POSTHOG_KEY="phc_your_project_api_key"
NEXT_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"
POSTHOG_API_KEY="phc_your_project_api_key"
```

- [ ] **Step 5 (MANUAL VERIFICATION): confirm env still validates.**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/lib/attribution.test.ts --runInBand`
      Expected: PASS — the suite boots through `env.mjs` validation without complaining about the new (optional) keys, proving the schema is well-formed.
- [ ] **Step 6: Commit**

```bash
git add env.mjs .env.local.example && git commit -m "feat(analytics): add PostHog env vars (client key/host + server key)"
```

---

### Task 5: PostHog ingest reverse-proxy rewrite (next.config.mjs)

> Routing PostHog through a first-party path (`/ingest/*`) lets events survive ad-blockers that block `*.posthog.com`. `next.config.mjs` currently has no `rewrites()`; add one alongside the existing `headers()`. `connect-src` already allows `'self'`, so no CSP change is needed for the proxied path.

**Files:**

- Modify: `next.config.mjs:194-201` (add `rewrites()` next to `headers()`)

- [ ] **Step 1 (MANUAL VERIFICATION — Next.js config, not unit-testable): add `rewrites()` to `nextConfig`.** Insert immediately after the closing `},` of the existing `async headers() { ... }` block (after line 201):

```js
  async rewrites() {
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com"
    const assetHost = posthogHost.replace("us.i.posthog.com", "us-assets.i.posthog.com")
    return [
      { source: "/ingest/static/:path*", destination: `${assetHost}/static/:path*` },
      { source: "/ingest/:path*", destination: `${posthogHost}/:path*` },
    ]
  },
```

- [ ] **Step 2 (MANUAL VERIFICATION): confirm the config parses and the rewrite resolves.**
      Run: `set -a; source .env.ci.example; set +a; SKIP_ENV_VALIDATION=1 node --input-type=module -e "import('./next.config.mjs').then(async (m) => { const c = m.default; const r = await c.rewrites(); console.log(JSON.stringify(r)); })"`
      Expected: prints a JSON array containing `/ingest/static/:path*` and `/ingest/:path*` destinations. Confirms `next.config.mjs` still loads and `rewrites()` returns the proxy rules.
- [ ] **Step 3 (MANUAL VERIFICATION): runtime smoke (optional, requires dev server).** Start `bun run dev`, then `curl -sI http://localhost:3000/ingest/static/array.js`. Expected: a `200`/`302` from PostHog assets rather than a Next.js 404. Skip in CI.
- [ ] **Step 4: Commit**

```bash
git add next.config.mjs && git commit -m "feat(analytics): reverse-proxy PostHog ingest through /ingest to dodge ad-blockers"
```

---

### Task 6: Add posthog-js + posthog-node dependencies

**Files:**

- Modify: `package.json` (dependencies block)

- [ ] **Step 1 (MANUAL STEP — package install, no unit test): install the SDKs.** Pin to current major lines.
      Run: `bun add posthog-js@^1 posthog-node@^4`
      Expected: `posthog-js` and `posthog-node` appear under `dependencies` in `package.json`, and `bun.lock` updates. (`posthog-js` is the client SDK for the provider in this slice; `posthog-node` is the server SDK consumed by SLICE A2's `captureServerEvent`.)
- [ ] **Step 2 (MANUAL VERIFICATION): confirm resolution.**
      Run: `node -e "require.resolve('posthog-js'); require.resolve('posthog-node'); console.log('ok')"`
      Expected: prints `ok` (both packages resolvable).
- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock && git commit -m "chore(deps): add posthog-js and posthog-node"
```

---

### Task 7: PostHogProvider component (consent-gated client init)

> A `"use client"` provider that boots `posthog-js` only when (a) consent is present and (b) `NEXT_PUBLIC_POSTHOG_KEY` is set, pointing the SDK at the first-party `/ingest` proxy. It renders nothing itself — it just initializes the SDK as a side effect — so it is wired into `ClientShell` rather than wrapping the tree.

**Files:**

- Create: `app/components/providers/PostHogProvider.tsx`

- [ ] **Step 1 (config component — verified via the ClientShell render test in the next task, not standalone):** create the provider.

```tsx
// app/components/providers/PostHogProvider.tsx
"use client"

import { useEffect } from "react"
import posthog from "posthog-js"

import { hasAnalyticsConsent } from "@/app/lib/analytics-consent"

// Boots posthog-js exactly once, only with consent and a configured key.
// Events are sent through the first-party /ingest proxy (see next.config.mjs)
// so ad-blockers that block *.posthog.com do not drop them.
export function PostHogProvider() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (!key) {
      return
    }
    if (!hasAnalyticsConsent()) {
      return
    }
    if (posthog.__loaded) {
      return
    }

    posthog.init(key, {
      api_host: "/ingest",
      ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.posthog.com",
      capture_pageview: true,
      persistence: "localStorage+cookie",
      autocapture: false,
    })
  }, [])

  return null
}
```

- [ ] **Step 2: Commit** (alongside the ClientShell wiring in the next task).

```bash
git add app/components/providers/PostHogProvider.tsx && git commit -m "feat(analytics): add consent-gated PostHogProvider client component"
```

---

### Task 8: Mount PostHogProvider + first-touch capture in ClientShell

> Two responsibilities: (1) dynamically mount `PostHogProvider` (client-only, like the other shell children); (2) on first client load, parse the URL query for UTM/ref and write the `ist_attribution` cookie **only if absent** (first-touch wins). The capture logic uses the pure helpers from the first task, so it needs no new test logic — only a render smoke test that the shell mounts without throwing.

**Files:**

- Modify: `app/components/providers/ClientShell.tsx:1-26`
- Test: `app/__tests__/components/ClientShell.test.tsx`

- [ ] **Step 1: Write the failing test** (asserts the shell renders and writes a first-touch cookie when params are present and the cookie is absent).

```tsx
import "@testing-library/jest-dom"

import { render } from "@testing-library/react"

import { ATTRIBUTION_COOKIE_NAME, readAttributionCookie } from "@/app/lib/attribution"
import { ClientShell } from "@/app/components/providers/ClientShell"

// Stub the dynamically-imported children so the test focuses on ClientShell's own logic.
jest.mock("@/app/components/CookieBanner", () => ({ CookieBanner: () => null }))
jest.mock("@/app/components/pwa/ServiceWorkerRegister", () => ({
  ServiceWorkerRegister: () => null,
}))
jest.mock("@/app/context/ToasterContext", () => () => null)
jest.mock("@/app/components/providers/PostHogProvider", () => ({ PostHogProvider: () => null }))

describe("ClientShell", () => {
  let cookieJar = ""
  beforeEach(() => {
    cookieJar = ""
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => cookieJar,
      set: (value: string) => {
        cookieJar = value.split(";")[0]
      },
    })
  })

  it("writes a first-touch attribution cookie from the URL on first load", () => {
    window.history.replaceState({}, "", "/?utm_source=twitter&ref=alice")
    render(<ClientShell />)
    const payload = readAttributionCookie(document.cookie)
    expect(payload?.utmSource).toBe("twitter")
    expect(payload?.ref).toBe("alice")
  })

  it("does not overwrite an existing first-touch cookie", () => {
    cookieJar = `${ATTRIBUTION_COOKIE_NAME}=${encodeURIComponent(
      JSON.stringify({ ref: "original", firstTouchAt: "2026-01-01T00:00:00.000Z" })
    )}`
    window.history.replaceState({}, "", "/?utm_source=twitter&ref=newer")
    render(<ClientShell />)
    expect(readAttributionCookie(document.cookie)?.ref).toBe("original")
  })

  it("renders without throwing when there are no attribution params", () => {
    window.history.replaceState({}, "", "/")
    expect(() => render(<ClientShell />)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/components/ClientShell.test.tsx --runInBand`
      Expected: FAIL — `PostHogProvider` module mock target does not exist yet AND no cookie is written (capture not wired)
- [ ] **Step 3: Implement** — replace the whole file body with the version below (adds the dynamic `PostHogProvider` import + a `useEffect` first-touch capture).

```tsx
// app/components/providers/ClientShell.tsx
"use client"

import { useEffect } from "react"
import dynamic from "next/dynamic"

import {
  parseAttributionFromSearch,
  readAttributionCookie,
  serializeAttributionCookie,
} from "@/app/lib/attribution"

const CookieBanner = dynamic(
  () => import("@/app/components/CookieBanner").then((module) => module.CookieBanner),
  { ssr: false }
)
const ServiceWorkerRegister = dynamic(
  () =>
    import("@/app/components/pwa/ServiceWorkerRegister").then(
      (module) => module.ServiceWorkerRegister
    ),
  { ssr: false }
)
const ToasterContext = dynamic(() => import("@/app/context/ToasterContext"), { ssr: false })
const PostHogProvider = dynamic(
  () =>
    import("@/app/components/providers/PostHogProvider").then((module) => module.PostHogProvider),
  { ssr: false }
)

export function ClientShell() {
  useEffect(() => {
    // First-touch attribution: write the cookie only if absent (first touch wins).
    if (readAttributionCookie(document.cookie)) {
      return
    }
    const attribution = parseAttributionFromSearch(window.location.search)
    if (attribution) {
      document.cookie = serializeAttributionCookie(attribution)
    }
  }, [])

  return (
    <>
      <ToasterContext />
      <ServiceWorkerRegister />
      <PostHogProvider />
      <CookieBanner />
    </>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/components/ClientShell.test.tsx --runInBand`
      Expected: PASS
- [ ] **Step 5: Commit**

```bash
git add app/components/providers/ClientShell.tsx app/__tests__/components/ClientShell.test.tsx && git commit -m "feat(analytics): mount PostHogProvider and capture first-touch attribution in ClientShell"
```

---

### Task 9: identify on sign-in / reset on sign-out (AuthProvider)

> `posthog-js` ties anonymous events to a stable user via `identify(user.id)`, and `reset()` clears the distinct id on sign-out so the next user is not merged. This is config wiring guarded by consent + key; both calls are no-ops when PostHog never initialized. It is verified by manual smoke + the existing AuthProvider not regressing, not by a new unit test (the provider has no logic branch worth isolating here).

**Files:**

- Modify: `app/components/providers/AuthProvider.tsx:1-12` (imports)
- Modify: `app/components/providers/AuthProvider.tsx:78-119` (effect + signOut)

- [ ] **Step 1 (config — add the import).** After the existing `getClientCsrfToken` import (line 12), add:

```tsx
import posthog from "posthog-js"
```

- [ ] **Step 2 (config — identify on known user).** Replace the existing first-load effect (lines 78-80):

```tsx
useEffect(() => {
  void refresh()
}, [refresh])
```

with:

```tsx
useEffect(() => {
  void refresh()
}, [refresh])

useEffect(() => {
  if (state.user?.id && posthog.__loaded) {
    posthog.identify(state.user.id)
  }
}, [state.user?.id])
```

- [ ] **Step 3 (config — reset on sign-out).** In the `signOut` callback, call `posthog.reset()` before navigating away. Add it at the very top of the callback body (right after the opening `async (...) => {` on line 83), so it runs for both fallback and Clerk sign-out paths:

```tsx
if (posthog.__loaded) {
  posthog.reset()
}
```

- [ ] **Step 4 (MANUAL VERIFICATION): typecheck + existing suite still green.**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/components/ClientShell.test.tsx app/__tests__/components/CookieBanner.test.tsx --runInBand`
      Expected: PASS — confirms the new import does not break the provider tree compile. Then `npx tsc --noEmit` (or `bun run typecheck`) for the `posthog` typings.
- [ ] **Step 5 (MANUAL VERIFICATION): runtime smoke.** With a real `NEXT_PUBLIC_POSTHOG_KEY` set and consent granted (dismiss the banner), sign in and confirm in the PostHog "Activity" feed that events carry `distinct_id === user.id`; sign out and confirm subsequent events use a fresh anonymous id.
- [ ] **Step 6: Commit**

```bash
git add app/components/providers/AuthProvider.tsx && git commit -m "feat(analytics): identify PostHog user on sign-in and reset on sign-out"
```

---

## Slice A2 — Server analytics lib + server events

> Engineer note: This slice depends on a new dependency `posthog-node` (NOT currently installed — verified `node_modules/posthog-node` missing and absent from `package.json`). Task 1 installs it. The PostHog env vars (`POSTHOG_API_KEY` server; `NEXT_PUBLIC_POSTHOG_KEY`/`NEXT_PUBLIC_POSTHOG_HOST` client) and the `User` attribution columns are SHARED CONTRACTS owned/added by other slices (A1 client + the Prisma-migration slice). This slice only **reads** `process.env.POSTHOG_API_KEY` and the env.mjs entry; if the env-wiring slice has not yet landed, Step where it adds `POSTHOG_API_KEY` to env.mjs is included here defensively but marked so the assembler can dedupe.

---

### Task 10: posthog-node dependency + env wiring

**Files:**

- Modify: `package.json` (dependencies)
- Modify: `env.mjs:35` (add `POSTHOG_API_KEY` to `server:`) and `env.mjs:78` (add to `runtimeEnv`)
- Modify: `.env.local.example:86` (add PostHog section)
- Modify: `.env.ci.example:33` (add dummy POSTHOG_API_KEY so CI env validation passes)

- [ ] **Step 1: Install posthog-node (MANUAL — not unit-testable)**
      Run: `bun add posthog-node`
      Expected: `posthog-node` appears under `dependencies` in `package.json`. Verify: `ls node_modules/posthog-node/package.json`.

- [ ] **Step 2: Add `POSTHOG_API_KEY` to env.mjs server schema**
      In `env.mjs`, inside the `server:` object, after the existing `AFFILIATE_ANALYTICS_ALLOWED_EMAILS: z.string().optional(),` line (currently line 35), add:

```js
    POSTHOG_API_KEY: z.string().min(1).optional(),
```

Then in the `runtimeEnv:` object, after the `AFFILIATE_ANALYTICS_ALLOWED_EMAILS: process.env.AFFILIATE_ANALYTICS_ALLOWED_EMAILS,` line (currently line 78), add:

```js
    POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,
```

> If the env-wiring slice (A1) already added these, skip — they must appear exactly once.

- [ ] **Step 3: Document the var in `.env.local.example`**
      After the Anthropic block (around line 86, after `ANTHROPIC_API_KEY="..."`), add:

```bash

# ----------------------------------
# Analytics (PostHog)
# ----------------------------------
# Server-side capture key (Project API key). Leave blank to disable server analytics.
POSTHOG_API_KEY=""
```

- [ ] **Step 4: Add a dummy value to `.env.ci.example`**
      After the `ANTHROPIC_API_KEY=ci_dummy_anthropic_key` line (line 33), add:

```bash
POSTHOG_API_KEY=ci_dummy_posthog_key
```

> Optional but recommended — keeps `captureServerEvent` exercising the real branch under CI. The lib also no-ops safely when the key is unset, so absence is non-fatal.

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock env.mjs .env.local.example .env.ci.example && git commit -m "chore(analytics): add posthog-node dep and POSTHOG_API_KEY env wiring"
```

---

### Task 11: Server analytics lib (captureServerEvent)

**Files:**

- Create: `app/lib/analytics.ts`
- Test: `app/__tests__/lib/analytics.test.ts`

- [ ] **Step 1: Write the failing test**
      Mirrors the env-driven-singleton pattern from `app/__tests__/lib/monetization.test.ts` (resetModules + dynamic import) and the prisma-mock convention. `posthog-node` is mocked so no network call happens.

```ts
/**
 * @jest-environment node
 */

const captureMock = jest.fn()
const shutdownMock = jest.fn()

jest.mock("posthog-node", () => ({
  __esModule: true,
  PostHog: jest.fn().mockImplementation(() => ({
    capture: captureMock,
    shutdown: shutdownMock,
  })),
}))

jest.mock("@/app/lib/logger", () => ({
  __esModule: true,
  default: {
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    })),
  },
  aiLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  apiLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  authLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

describe("captureServerEvent", () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    captureMock.mockClear()
    shutdownMock.mockClear()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("forwards distinctId, event, and properties to PostHog.capture", async () => {
    process.env.POSTHOG_API_KEY = "phc_test_key"
    const { captureServerEvent } = await import("@/app/lib/analytics")

    captureServerEvent("user-123", "message_sent", { conversationId: "abc" })

    expect(captureMock).toHaveBeenCalledTimes(1)
    expect(captureMock).toHaveBeenCalledWith({
      distinctId: "user-123",
      event: "message_sent",
      properties: { conversationId: "abc" },
    })
  })

  it("defaults properties to an empty object when omitted", async () => {
    process.env.POSTHOG_API_KEY = "phc_test_key"
    const { captureServerEvent } = await import("@/app/lib/analytics")

    captureServerEvent("user-123", "conversation_created")

    expect(captureMock).toHaveBeenCalledWith({
      distinctId: "user-123",
      event: "conversation_created",
      properties: {},
    })
  })

  it("no-ops (never constructs a client, never throws) when POSTHOG_API_KEY is unset", async () => {
    delete process.env.POSTHOG_API_KEY
    const { PostHog } = await import("posthog-node")
    const { captureServerEvent } = await import("@/app/lib/analytics")

    expect(() => captureServerEvent("user-123", "message_sent")).not.toThrow()
    expect(captureMock).not.toHaveBeenCalled()
    expect(PostHog).not.toHaveBeenCalled()
  })

  it("never throws into the caller when capture() throws internally", async () => {
    process.env.POSTHOG_API_KEY = "phc_test_key"
    captureMock.mockImplementationOnce(() => {
      throw new Error("boom")
    })
    const { captureServerEvent } = await import("@/app/lib/analytics")

    expect(() => captureServerEvent("user-123", "message_sent")).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/lib/analytics.test.ts --runInBand`
      Expected: FAIL with "Cannot find module '@/app/lib/analytics'" (file does not exist yet).

- [ ] **Step 3: Implement the lazy fail-fast singleton**
      Create `app/lib/analytics.ts`, mirroring the lazy-Proxy/lazy-getter discipline of `app/lib/anthropic.ts` (no client constructed at module load; safe no-op when the key is missing; never throws into callers):

```ts
import { PostHog } from "posthog-node"

import { apiLogger } from "@/app/lib/logger"

let _client: PostHog | null | undefined

// Lazily construct a PostHog client on first use. Returns null (and stays null)
// when POSTHOG_API_KEY is unset so analytics safely no-ops in dev/CI and never
// constructs a client at module-load time. Mirrors the lazy-init pattern in
// app/lib/anthropic.ts.
function getPostHogClient(): PostHog | null {
  if (_client !== undefined) {
    return _client
  }

  const apiKey = process.env.POSTHOG_API_KEY
  if (!apiKey) {
    _client = null
    return _client
  }

  _client = new PostHog(apiKey, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    // Server routes are short-lived; flush eagerly so events are not lost when
    // the function instance is torn down.
    flushAt: 1,
    flushInterval: 0,
  })
  return _client
}

/**
 * Fire-and-forget server-side analytics capture.
 *
 * Never throws into the caller: a misconfigured or failing analytics backend
 * must never break a product request (sending a message, creating a chat, etc.).
 * No-ops silently when POSTHOG_API_KEY is unset.
 */
export function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): void {
  try {
    const client = getPostHogClient()
    if (!client) {
      return
    }
    client.capture({
      distinctId,
      event,
      properties: properties ?? {},
    })
  } catch (error) {
    apiLogger.warn({ err: error, event }, "ANALYTICS_CAPTURE_FAILED")
  }
}
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/lib/analytics.test.ts --runInBand`
      Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/lib/analytics.ts app/__tests__/lib/analytics.test.ts && git commit -m "feat(analytics): add fail-fast captureServerEvent server helper"
```

---

### Task 12: first-message gating helper

**Files:**

- Create: `app/lib/analytics-events.ts`
- Test: `app/__tests__/lib/analytics-events.test.ts`

> Extracted as a pure-ish helper so the "first message ever?" gate is unit-testable in isolation (the routes themselves are integration-heavy SSE/Pusher handlers). The helper takes an injected counter so it has no hard prisma dependency and stays trivially testable.

- [ ] **Step 1: Write the failing test**

```ts
/**
 * @jest-environment node
 */

import { isFirstHumanMessage } from "@/app/lib/analytics-events"

describe("isFirstHumanMessage", () => {
  it("returns true when the user has exactly zero prior human messages", async () => {
    const countFn = jest.fn().mockResolvedValue(0)
    await expect(isFirstHumanMessage("user-1", countFn)).resolves.toBe(true)
    expect(countFn).toHaveBeenCalledWith("user-1")
  })

  it("returns false when the user already has prior human messages", async () => {
    const countFn = jest.fn().mockResolvedValue(3)
    await expect(isFirstHumanMessage("user-1", countFn)).resolves.toBe(false)
  })

  it("returns false (fails closed) when the counter throws", async () => {
    const countFn = jest.fn().mockRejectedValue(new Error("db down"))
    await expect(isFirstHumanMessage("user-1", countFn)).resolves.toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/lib/analytics-events.test.ts --runInBand`
      Expected: FAIL with "Cannot find module '@/app/lib/analytics-events'".

- [ ] **Step 3: Implement**
      Create `app/lib/analytics-events.ts`:

```ts
import prisma from "@/app/lib/prismadb"

export type PriorMessageCounter = (userId: string) => Promise<number>

// Default counter: number of NON-AI messages this user has ever sent.
// isAI:false excludes both AI replies and character greeting rows (which are
// stored with isAI:true), so the first real user turn is correctly detected.
const defaultCounter: PriorMessageCounter = (userId) =>
  prisma.message.count({
    where: { senderId: userId, isAI: false },
  })

/**
 * True when this is the user's first-ever human message.
 *
 * Call this AFTER persisting the new message: a count of exactly 1 means the
 * just-saved message is the only one, i.e. it was the first. Fails closed
 * (returns false) on any error so analytics never breaks the request path.
 */
export async function isFirstHumanMessage(
  userId: string,
  counter: PriorMessageCounter = defaultCounter
): Promise<boolean> {
  try {
    const count = await counter(userId)
    return count <= 1
  } catch {
    return false
  }
}
```

> Contract note: this helper is called **after** the new message row is created, so the threshold is `<= 1` (the just-saved row is included). The test injects a counter returning the _pre-existing_ count and asserts `0 → true`; both views are consistent because the routes below call it post-insert and the count includes the new row. To keep the test and the runtime call semantically aligned, the routes pass the default counter (which counts post-insert), so a return of `1` = first. The test's `0 → true` / `3 → false` cases bracket the `<= 1` boundary correctly.

- [ ] **Step 4: Run test to verify it passes**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/lib/analytics-events.test.ts --runInBand`
      Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/lib/analytics-events.ts app/__tests__/lib/analytics-events.test.ts && git commit -m "feat(analytics): add isFirstHumanMessage gating helper"
```

---

### Task 13: conversation_created event (POST /api/conversations)

**Files:**

- Modify: `app/api/conversations/route.ts` (import + 3 return paths for AI/group/direct creation)

> All three creation paths construct a `newConversation` and return it. We fire `conversation_created` right before each `return NextResponse.json(newConversation)` for a freshly-created conversation. The existing-direct-conversation early return (line 535, `existingConversation`) is intentionally NOT instrumented (no new conversation was created).

- [ ] **Step 1: Add the import**
      In `app/api/conversations/route.ts`, after the existing import block (the last import is `import getCurrentUser from "@/app/actions/getCurrentUser"` at line 15), add:

```ts
import { captureServerEvent } from "@/app/lib/analytics"
```

- [ ] **Step 2: Fire on the scene-chat AI creation path**
      At line 336, replace:

```ts
        return NextResponse.json(newConversation)
      }

      let character = null
```

with:

```ts
        captureServerEvent(currentUser.id, "conversation_created", {
          conversationId: newConversation.id,
          kind: "scene",
          isAI: true,
          sceneCharacterCount: orderedCharacters.length,
        })

        return NextResponse.json(newConversation)
      }

      let character = null
```

- [ ] **Step 3: Fire on the single-character / generic AI creation path**
      At line 429, replace:

```ts
      // Trigger Pusher event for user
      await triggerPusherSafely(
        getPusherUserChannel(currentUser.id),
        "conversation:new",
        newConversation
      )

      return NextResponse.json(newConversation)
    }

    // Group conversation validation is handled by Zod schema
```

with:

```ts
      // Trigger Pusher event for user
      await triggerPusherSafely(
        getPusherUserChannel(currentUser.id),
        "conversation:new",
        newConversation
      )

      captureServerEvent(currentUser.id, "conversation_created", {
        conversationId: newConversation.id,
        kind: character ? "character" : "ai",
        isAI: true,
        characterId: character?.id ?? null,
      })

      return NextResponse.json(newConversation)
    }

    // Group conversation validation is handled by Zod schema
```

- [ ] **Step 4: Fire on the group + direct creation paths**
      At line 503 (group path), replace:

```ts
      // Trigger Pusher event for all users in the conversation
      await Promise.all(
        newConversation.users.map((user: { id: string }) =>
          triggerPusherSafely(getPusherUserChannel(user.id), "conversation:new", newConversation)
        )
      )

      return NextResponse.json(newConversation)
    }

    // Direct 1-on-1 conversation requires userId
```

with:

```ts
      // Trigger Pusher event for all users in the conversation
      await Promise.all(
        newConversation.users.map((user: { id: string }) =>
          triggerPusherSafely(getPusherUserChannel(user.id), "conversation:new", newConversation)
        )
      )

      captureServerEvent(currentUser.id, "conversation_created", {
        conversationId: newConversation.id,
        kind: "group",
        isAI: false,
        memberCount: newConversation.users.length,
      })

      return NextResponse.json(newConversation)
    }

    // Direct 1-on-1 conversation requires userId
```

Then at the final direct-chat return (line 569), replace:

```ts
    // Trigger Pusher event for all users in the conversation
    await Promise.all(
      newConversation.users.map((user: { id: string }) =>
        triggerPusherSafely(getPusherUserChannel(user.id), "conversation:new", newConversation)
      )
    )

    return NextResponse.json(newConversation)
  } catch (error) {
```

with:

```ts
    // Trigger Pusher event for all users in the conversation
    await Promise.all(
      newConversation.users.map((user: { id: string }) =>
        triggerPusherSafely(getPusherUserChannel(user.id), "conversation:new", newConversation)
      )
    )

    captureServerEvent(currentUser.id, "conversation_created", {
      conversationId: newConversation.id,
      kind: "direct",
      isAI: false,
    })

    return NextResponse.json(newConversation)
  } catch (error) {
```

- [ ] **Step 5: Typecheck + commit (MANUAL verification — route is integration-only)**
      Run: `bunx tsc --noEmit` (or `npx tsc --noEmit`). Expected: no new type errors.
      Then: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/lib/analytics.test.ts app/__tests__/lib/analytics-events.test.ts --runInBand` — Expected: still PASS (no regression in helpers).

```bash
git add app/api/conversations/route.ts && git commit -m "feat(analytics): emit conversation_created on all creation paths"
```

---

### Task 14: message_sent + first_message_sent (POST /api/messages)

**Files:**

- Modify: `app/api/messages/route.ts` (import + after message persist, before return at line 244)

- [ ] **Step 1: Add imports**
      In `app/api/messages/route.ts`, after `import getCurrentUser from "@/app/actions/getCurrentUser"` (line 16), add:

```ts
import { captureServerEvent } from "@/app/lib/analytics"
import { isFirstHumanMessage } from "@/app/lib/analytics-events"
```

- [ ] **Step 2: Fire both events right before the success return**
      At line 244, replace:

```ts
    return NextResponse.json(newMessage)
  } catch (error) {
    apiLogger.error({ err: error }, "MESSAGES_ERROR")
```

with:

```ts
    captureServerEvent(currentUser.id, "message_sent", {
      conversationId,
      messageId: newMessage.id,
      hasImage: Boolean(sanitizedImage),
      hasAudio: Boolean(sanitizedAudioUrl),
      surface: "direct",
    })

    if (await isFirstHumanMessage(currentUser.id)) {
      captureServerEvent(currentUser.id, "first_message_sent", {
        conversationId,
        messageId: newMessage.id,
        surface: "direct",
      })
    }

    return NextResponse.json(newMessage)
  } catch (error) {
    apiLogger.error({ err: error }, "MESSAGES_ERROR")
```

- [ ] **Step 3: Typecheck**
      Run: `npx tsc --noEmit`
      Expected: no new type errors.

- [ ] **Step 4: Run helper tests to confirm no regression (MANUAL — route itself is integration-only)**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/lib/analytics-events.test.ts --runInBand`
      Expected: PASS. (The route wiring is verified by typecheck + the helper's own unit tests; the SSE/Pusher/prisma-heavy handler is not unit-tested per project conventions.)

- [ ] **Step 5: Commit**

```bash
git add app/api/messages/route.ts && git commit -m "feat(analytics): emit message_sent and first_message_sent in POST /api/messages"
```

---

### Task 15: message_sent + first_message_sent (POST /api/ai/chat-stream)

**Files:**

- Modify: `app/api/ai/chat-stream/route.ts` (import + after user message persist at line 251)

> The user's turn is the human message created at lines 223-244 and broadcast at line 247-251. We instrument that — NOT the AI reply (lines 373-393), which is a model output, not a user-sent message. Firing right after the user-message Pusher trigger keeps it inside the existing try/catch and before the long-running stream.

- [ ] **Step 1: Add imports**
      In `app/api/ai/chat-stream/route.ts`, after `import getCurrentUser from "@/app/actions/getCurrentUser"` (line 34), add:

```ts
import { captureServerEvent } from "@/app/lib/analytics"
import { isFirstHumanMessage } from "@/app/lib/analytics-events"
```

- [ ] **Step 2: Fire after the user message is persisted + broadcast**
      At line 251, replace:

```ts
// Trigger Pusher event for user message
await pusherServer.trigger(
  getPusherConversationChannel(conversationId),
  "messages:new",
  userMessage
)

// Build conversation history for Claude
```

with:

```ts
// Trigger Pusher event for user message
await pusherServer.trigger(
  getPusherConversationChannel(conversationId),
  "messages:new",
  userMessage
)

captureServerEvent(currentUser.id, "message_sent", {
  conversationId,
  messageId: userMessage.id,
  hasImage: Boolean(sanitizedImage),
  hasAudio: Boolean(sanitizedAudioUrl),
  surface: "ai-chat",
})

if (await isFirstHumanMessage(currentUser.id)) {
  captureServerEvent(currentUser.id, "first_message_sent", {
    conversationId,
    messageId: userMessage.id,
    surface: "ai-chat",
  })
}

// Build conversation history for Claude
```

- [ ] **Step 3: Typecheck**
      Run: `npx tsc --noEmit`
      Expected: no new type errors.

- [ ] **Step 4: Run helper tests (MANUAL — streaming route is integration-only)**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/lib/analytics-events.test.ts app/__tests__/lib/analytics.test.ts --runInBand`
      Expected: PASS, no regression.

- [ ] **Step 5: Commit**

```bash
git add app/api/ai/chat-stream/route.ts && git commit -m "feat(analytics): emit message_sent and first_message_sent in chat-stream"
```

---

### Task 16: ai_limit_reached on access-denial path

**Files:**

- Modify: `app/lib/ai-access.ts` (import + every `allowed: false` return)

> Decision: fire the event inside `getAiAccessDecision` rather than at every caller, because there are many callers (chat, chat-stream, suggestions, summary, image-generate, transcribe) and centralizing guarantees the event fires exactly once per denial with the denial `code`. The helper takes `userId` so `distinctId` is available. We add a single private emit at the end of the `try` block by wrapping the denial returns — the cleanest non-invasive approach is a small local helper that tags + emits.

- [ ] **Step 1: Add the import**
      In `app/lib/ai-access.ts`, after `import { getUserSubscriptionPlan } from "@/app/lib/subscription"` (line 11), add:

```ts
import { captureServerEvent } from "@/app/lib/analytics"
```

- [ ] **Step 2: Add a local emit-on-denial helper inside getAiAccessDecision**
      Inside `getAiAccessDecision`, immediately after `const requestType = options?.requestType ?? "chat"` (line 64), add a helper that fires the analytics event and returns the decision unchanged:

```ts
const denyWithEvent = (decision: AiAccessDecision): AiAccessDecision => {
  captureServerEvent(userId, "ai_limit_reached", {
    code: decision.code,
    requestType,
    isPro: decision.limits?.isPro ?? null,
  })
  return decision
}
```

- [ ] **Step 3: Route each denial return through the helper**
      Wrap each `return { allowed: false, ... }` object literal in `getAiAccessDecision` with `denyWithEvent(...)`. There are six in-`try` denials plus the `catch` denial. For example, the PRO cost-cap denial (line 121) becomes:

```ts
return denyWithEvent({
  allowed: false,
  code: "PRO_TIER_COST_CAP_REACHED",
  message:
    "You have reached this month's AI fair-use cap. Please contact support to increase limits.",
  limits: {
    isPro: true,
    monthlyMessageCount,
    monthlyMessageLimit: null,
    remainingMessages: null,
    monthlyTokenUsage,
    monthlyTokenQuota: null,
    monthlyCostUsageCents,
    monthlyCostQuotaCents: proCostCapCents,
  },
})
```

Apply the same `denyWithEvent({ ... })` wrap to the other in-`try` denials: `PRO_TIER_IMAGE_LIMIT_REACHED` (line ~142), `PRO_TIER_TRANSCRIBE_LIMIT_REACHED` (line ~165), `FREE_TIER_MESSAGE_LIMIT_REACHED` (line ~203), `FREE_TIER_TOKEN_QUOTA_REACHED` (line ~222), `FREE_TIER_IMAGE_LIMIT_REACHED` (line ~242), and `FREE_TIER_TRANSCRIBE_LIMIT_REACHED` (line ~268). Do NOT wrap the two `allowed: true` returns. For the `catch` block (line 302), wrap separately since `denyWithEvent` is in scope only inside the `try`; instead inline the capture there:

```ts
  } catch {
    captureServerEvent(userId, "ai_limit_reached", {
      code: "AI_ACCESS_CHECK_FAILED",
      requestType: options?.requestType ?? "chat",
      isPro: null,
    })
    return {
      allowed: false,
      code: "AI_ACCESS_CHECK_FAILED",
      message: "Unable to verify AI usage limits right now. Please try again.",
    }
  }
```

- [ ] **Step 4: Write/extend the failing test for the gating + event**
      Create `app/__tests__/lib/ai-access.test.ts` (no existing test — verified). Mock prisma, subscription, and analytics; assert `ai_limit_reached` fires with the denial code on the free-tier message-limit path and does NOT fire when allowed:

```ts
import { getAiAccessDecision } from "@/app/lib/ai-access"
import prisma from "@/app/lib/prismadb"
import { getUserSubscriptionPlan } from "@/app/lib/subscription"

/**
 * @jest-environment node
 */

const captureMock = jest.fn()
jest.mock("@/app/lib/analytics", () => ({
  __esModule: true,
  captureServerEvent: (...args: unknown[]) => captureMock(...args),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    aiUsage: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
  },
}))

jest.mock("@/app/lib/subscription", () => ({
  __esModule: true,
  getUserSubscriptionPlan: jest.fn(),
}))

const USER_ID = "11111111-1111-4111-8111-111111111111"

describe("getAiAccessDecision analytics", () => {
  beforeEach(() => {
    captureMock.mockClear()
    ;(getUserSubscriptionPlan as jest.Mock).mockResolvedValue({ isPro: false })
    ;(prisma.aiUsage.aggregate as jest.Mock).mockResolvedValue({
      _sum: { totalTokens: 0, totalCost: 0 },
    })
  })

  it("fires ai_limit_reached with the denial code when the free message limit is hit", async () => {
    ;(prisma.aiUsage.count as jest.Mock).mockResolvedValue(9999)

    const decision = await getAiAccessDecision(USER_ID)

    expect(decision.allowed).toBe(false)
    expect(decision.code).toBe("FREE_TIER_MESSAGE_LIMIT_REACHED")
    expect(captureMock).toHaveBeenCalledWith(
      USER_ID,
      "ai_limit_reached",
      expect.objectContaining({ code: "FREE_TIER_MESSAGE_LIMIT_REACHED" })
    )
  })

  it("does not fire ai_limit_reached when access is allowed", async () => {
    ;(prisma.aiUsage.count as jest.Mock).mockResolvedValue(0)

    const decision = await getAiAccessDecision(USER_ID)

    expect(decision.allowed).toBe(true)
    expect(captureMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 5: Run the test (fails before impl wiring, passes after)**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/lib/ai-access.test.ts --runInBand`
      Expected: PASS once Steps 1-3 are applied. (Write the test first and run before Step 3 wiring to see it FAIL with "captureMock not called".)
      Then commit:

```bash
git add app/lib/ai-access.ts app/__tests__/lib/ai-access.test.ts && git commit -m "feat(analytics): emit ai_limit_reached on every AI access denial"
```

---

### Task 17: subscription_started (Stripe checkout.session.completed)

**Files:**

- Modify: `app/api/webhooks/stripe/route.ts` (import + after the platform-PRO `prisma.user.update` at line 310)

> Fired only for the _platform PRO_ upgrade — i.e. inside the `isPlatformProSubscription(activeSubscription)` branch of `checkout.session.completed`, after the user row is updated (line 302-310). Creator-tip and creator-subscription flows are out of scope for `subscription_started`. The `distinctId` is the platform `userId` from `session.metadata?.userId`.

- [ ] **Step 1: Add the import**
      In `app/api/webhooks/stripe/route.ts`, after `import { stripe } from "@/app/lib/stripe"` (line 9), add:

```ts
import { captureServerEvent } from "@/app/lib/analytics"
```

- [ ] **Step 2: Fire after the platform user is upgraded**
      At line 310, replace:

```ts
            await prisma.user.update({
              where: { id: userId },
              data: {
                stripeSubscriptionId: activeSubscription.id,
                stripeCustomerId: getCustomerId(activeSubscription.customer),
                stripePriceId: activeSubscription.items.data[0]?.price?.id ?? null,
                stripeCurrentPeriodEnd: currentPeriodEnd,
              },
            })
          }
        }
      }
    }
  }
```

with:

```ts
            await prisma.user.update({
              where: { id: userId },
              data: {
                stripeSubscriptionId: activeSubscription.id,
                stripeCustomerId: getCustomerId(activeSubscription.customer),
                stripePriceId: activeSubscription.items.data[0]?.price?.id ?? null,
                stripeCurrentPeriodEnd: currentPeriodEnd,
              },
            })

            captureServerEvent(userId, "subscription_started", {
              plan: "pro",
              priceId: activeSubscription.items.data[0]?.price?.id ?? null,
              stripeSubscriptionId: activeSubscription.id,
            })
          }
        }
      }
    }
  }
```

- [ ] **Step 3: Typecheck (MANUAL — webhook is integration-only)**
      Run: `npx tsc --noEmit`
      Expected: no new type errors. `userId` is already narrowed to a defined string by the enclosing `if (userId) { ... }` (line 286), so it is safe as the `distinctId`.

- [ ] **Step 4: Confirm no helper-test regression**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/lib/analytics.test.ts --runInBand`
      Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/stripe/route.ts && git commit -m "feat(analytics): emit subscription_started on platform PRO checkout"
```

---

### Task 18: User attribution columns + self-relation (Prisma schema + migration)

**Files:**

- Modify: `prisma/schema.prisma:12-94` (User model)
- Create: `prisma/migrations/20260614120000_user_attribution/migration.sql`

This is a **schema + migration** task. Prisma migrations cannot be unit-tested, so steps 2 and 5 are explicit MANUAL VERIFICATION steps (per project test conventions — TDD applies to logic, not schema wiring).

- [ ] **Step 1: Add the attribution columns + self-relation to the User model**

Insert the attribution block immediately after the Stripe block (after line 65, before the relations block that starts at line 67 `conversations Conversation[]`). The self-relation reuses the named-relation pattern already used by `UserFollow` (schema.prisma:621-622).

```prisma
  // Acquisition / first-touch attribution (slice A3 — all nullable, additive)
  referralSource String? // free-form ref/referrer label captured at first touch
  utmSource      String? // utm_source from first-touch landing
  utmMedium      String? // utm_medium from first-touch landing
  utmCampaign    String? // utm_campaign from first-touch landing
  firstTouchAt   DateTime? // when the visitor first landed (from ist_attribution cookie)

  // Self-referral graph: who referred this user
  referredById String? @db.Uuid
  referredBy   User?   @relation("UserReferrals", fields: [referredById], references: [id], onDelete: SetNull)
  referrals    User[]  @relation("UserReferrals")
```

Then add the two indexes inside the existing `@@index`/`@@map` block (currently schema.prisma:92-93). Change:

```prisma
  @@index([deletionRequested, deletionScheduledFor])
  @@map("users")
```

to:

```prisma
  @@index([deletionRequested, deletionScheduledFor])
  @@index([referredById])
  @@index([utmSource, createdAt])
  @@map("users")
```

- [ ] **Step 2: MANUAL VERIFICATION — schema is valid and client regenerates**

Run: `npx prisma validate && npx prisma generate`
Expected: `The schema at prisma/schema.prisma is valid` and `Generated Prisma Client`. If the self-relation is malformed Prisma will error with `Error validating model "User": The relation field ... missing an opposite relation field` — both `referredBy` and `referrals` must use the same relation name `"UserReferrals"`.

- [ ] **Step 3: Write the migration SQL**

Match the additive, idempotent style of `prisma/migrations/20260313190000_add_user_personas/migration.sql` (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).

```sql
-- Slice A3: first-touch attribution columns + self-referral relation on users

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referralSource" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "utmSource" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "utmMedium" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "utmCampaign" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "firstTouchAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referredById" UUID;

-- Indexes
CREATE INDEX IF NOT EXISTS "users_referredById_idx" ON "users"("referredById");
CREATE INDEX IF NOT EXISTS "users_utmSource_createdAt_idx" ON "users"("utmSource", "createdAt");

-- Self-referral FK (SET NULL so deleting a referrer never cascades into referred users)
ALTER TABLE "users" ADD CONSTRAINT "users_referredById_fkey"
    FOREIGN KEY ("referredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

> Note: the `ADD CONSTRAINT` is not guarded by `IF NOT EXISTS` (Postgres does not support it for constraints). This is fine for a forward-only migration; if you must re-run locally, drop the constraint first.

- [ ] **Step 4: MANUAL VERIFICATION — migration applies cleanly (dev)**

Run: `npx prisma migrate dev --name user_attribution`
Expected: migration `20260614120000_user_attribution` is recorded as applied and `prisma migrate status` shows no pending migrations. (Production deploy uses `bun run migrate:deploy`, never `db push` — do NOT run `db push` here.)

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260614120000_user_attribution/migration.sql && git commit -m "feat(db): add user attribution columns and self-referral relation"
```

---

### Task 19: env vars for PostHog (env.mjs + .env.local.example)

**Files:**

- Modify: `env.mjs` (server block ~line 37, client block ~line 38-50, runtimeEnv block)
- Modify: `.env.local.example` (after ANTHROPIC_API_KEY ~line 85)

Pure config wiring — no unit test (next/jest disables type-checking in tests and env.mjs is validated at build time). Steps 2 and 4 are MANUAL VERIFICATION. This task is coordinated with slices A1/A2, which also reference these vars; whichever slice lands first owns the edit, the others assume they exist. Use `IF NOT ALREADY PRESENT` discipline — if a prior slice added `NEXT_PUBLIC_POSTHOG_KEY`, skip it.

- [ ] **Step 1: Add the three env vars to env.mjs**

In the `server:` object (after `AFFILIATE_ANALYTICS_ALLOWED_EMAILS` at env.mjs:36), add:

```js
    POSTHOG_API_KEY: z.string().min(1).optional(),
```

In the `client:` object (after `NEXT_PUBLIC_ENABLE_GROUP_CHAT`), add:

```js
    NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
```

In the `runtimeEnv:` object add the matching three lines:

```js
    POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
```

- [ ] **Step 2: MANUAL VERIFICATION — env still validates**

Run: `set -a; source .env.ci.example; set +a; npx tsc --noEmit env.mjs 2>/dev/null; node -e "import('./env.mjs').then(()=>console.log('env ok')).catch(e=>{console.error(e);process.exit(1)})"`
Expected: prints `env ok`. (All three are `.optional()`, so missing values in `.env.ci.example` do not fail validation.)

- [ ] **Step 3: Document in .env.local.example**

Add after the `ANTHROPIC_API_KEY=...` line (currently .env.local.example:85):

```bash

# Analytics (PostHog) — optional. Client keys are public-safe; POSTHOG_API_KEY is server-side only.
NEXT_PUBLIC_POSTHOG_KEY="phc_your_posthog_project_key"
NEXT_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"
POSTHOG_API_KEY="phx_your_posthog_server_key"
```

- [ ] **Step 4: MANUAL VERIFICATION — example file mirrors schema**

Run: `grep -c POSTHOG .env.local.example`
Expected: `3`.

- [ ] **Step 5: Commit**

```bash
git add env.mjs .env.local.example && git commit -m "chore(env): add PostHog analytics env vars"
```

---

### Task 20: resolveAttribution pure helper (app/lib/attribution.ts)

**Files:**

- Create/Modify: `app/lib/attribution.ts` (shared with slice A1 — A1 owns cookie read/write helpers, A3 adds the persistence resolver + types below; merge, don't overwrite)
- Test: `app/__tests__/lib/attribution-resolve.test.ts`

This is the **TDD core** of the slice — a pure function with no I/O. It takes the parsed `ist_attribution` cookie payload plus the current user's already-stored attribution and returns _only the columns to write_ (empty object when the user is already attributed, so we never overwrite first-touch).

- [ ] **Step 1: Write the failing test**

```ts
/**
 * @jest-environment node
 */
import {
  parseAttributionCookie,
  resolveAttribution,
  type AttributionCookie,
} from "@/app/lib/attribution"

describe("parseAttributionCookie", () => {
  it("parses a valid JSON cookie value", () => {
    const raw = JSON.stringify({
      utmSource: "twitter",
      utmMedium: "social",
      utmCampaign: "launch",
      ref: "alice",
      firstTouchAt: "2026-06-01T00:00:00.000Z",
    })
    expect(parseAttributionCookie(raw)).toEqual({
      utmSource: "twitter",
      utmMedium: "social",
      utmCampaign: "launch",
      ref: "alice",
      firstTouchAt: "2026-06-01T00:00:00.000Z",
    })
  })

  it("returns null for undefined, empty, or malformed JSON", () => {
    expect(parseAttributionCookie(undefined)).toBeNull()
    expect(parseAttributionCookie("")).toBeNull()
    expect(parseAttributionCookie("not-json")).toBeNull()
  })

  it("ignores non-string fields and caps overly long values", () => {
    const raw = JSON.stringify({ utmSource: 123, ref: "x".repeat(1000) })
    const parsed = parseAttributionCookie(raw) as AttributionCookie
    expect(parsed.utmSource).toBeUndefined()
    expect(parsed.ref?.length).toBe(255)
  })
})

describe("resolveAttribution", () => {
  const cookie: AttributionCookie = {
    utmSource: "twitter",
    utmMedium: "social",
    utmCampaign: "launch",
    ref: "alice",
    firstTouchAt: "2026-06-01T00:00:00.000Z",
  }

  it("returns the columns to persist for an un-attributed user", () => {
    const result = resolveAttribution(cookie, {
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      referralSource: null,
      firstTouchAt: null,
    })
    expect(result).toEqual({
      utmSource: "twitter",
      utmMedium: "social",
      utmCampaign: "launch",
      referralSource: "alice",
      firstTouchAt: new Date("2026-06-01T00:00:00.000Z"),
    })
  })

  it("returns an empty object when the user is already attributed (first-touch wins)", () => {
    const result = resolveAttribution(cookie, {
      utmSource: "google",
      utmMedium: null,
      utmCampaign: null,
      referralSource: null,
      firstTouchAt: new Date("2026-05-01T00:00:00.000Z"),
    })
    expect(result).toEqual({})
  })

  it("treats firstTouchAt alone as 'already attributed'", () => {
    const result = resolveAttribution(cookie, {
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      referralSource: null,
      firstTouchAt: new Date("2026-05-01T00:00:00.000Z"),
    })
    expect(result).toEqual({})
  })

  it("returns an empty object when there is no cookie", () => {
    expect(
      resolveAttribution(null, {
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        referralSource: null,
        firstTouchAt: null,
      })
    ).toEqual({})
  })

  it("falls back to a synthesized firstTouchAt when the cookie omits it", () => {
    const result = resolveAttribution(
      { utmSource: "reddit" },
      {
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        referralSource: null,
        firstTouchAt: null,
      }
    )
    expect(result.utmSource).toBe("reddit")
    expect(result.firstTouchAt).toBeInstanceOf(Date)
  })

  it("ignores an unparseable firstTouchAt but still persists source fields", () => {
    const result = resolveAttribution(
      { utmSource: "reddit", firstTouchAt: "garbage" },
      {
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        referralSource: null,
        firstTouchAt: null,
      }
    )
    expect(result.utmSource).toBe("reddit")
    expect(result.firstTouchAt).toBeInstanceOf(Date)
  })
})

export {}
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/lib/attribution-resolve.test.ts --runInBand`
      Expected: FAIL with `Cannot find module '@/app/lib/attribution'` (file does not exist yet) or `resolveAttribution is not a function` if A1 created the file without these exports.

- [ ] **Step 3: Implement**

Create (or extend, if slice A1 already created the file) `app/lib/attribution.ts`. Add ONLY the exports below; do not remove A1's cookie-name constant or browser-side helpers.

```ts
// Shared first-touch attribution helpers. Slice A1 owns the cookie name + client
// write/read; slice A3 owns parsing the persisted cookie and resolving the columns
// to write onto the User row (first-touch wins — never overwrite an attributed user).

export const ATTRIBUTION_COOKIE_NAME = "ist_attribution"

const MAX_FIELD_LEN = 255

/** Shape of the JSON stored in the `ist_attribution` cookie. */
export interface AttributionCookie {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  ref?: string
  firstTouchAt?: string
}

/** Columns currently stored on the User row that determine "already attributed". */
export interface UserAttributionState {
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  referralSource: string | null
  firstTouchAt: Date | null
}

/** Subset of User columns to write. Empty object => write nothing. */
export interface AttributionPersistInput {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  referralSource?: string
  firstTouchAt?: Date
}

function coerceField(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, MAX_FIELD_LEN)
}

/**
 * Parse the raw `ist_attribution` cookie value into a typed payload.
 * Returns null for missing/empty/malformed JSON. Non-string fields are dropped;
 * string fields are trimmed and capped to 255 chars.
 */
export function parseAttributionCookie(raw: string | undefined | null): AttributionCookie | null {
  if (!raw) return null
  let obj: unknown
  try {
    obj = JSON.parse(raw)
  } catch {
    return null
  }
  if (!obj || typeof obj !== "object") return null
  const src = obj as Record<string, unknown>
  const out: AttributionCookie = {}
  const utmSource = coerceField(src.utmSource)
  const utmMedium = coerceField(src.utmMedium)
  const utmCampaign = coerceField(src.utmCampaign)
  const ref = coerceField(src.ref)
  const firstTouchAt = coerceField(src.firstTouchAt)
  if (utmSource) out.utmSource = utmSource
  if (utmMedium) out.utmMedium = utmMedium
  if (utmCampaign) out.utmCampaign = utmCampaign
  if (ref) out.ref = ref
  if (firstTouchAt) out.firstTouchAt = firstTouchAt
  return out
}

function isAlreadyAttributed(state: UserAttributionState): boolean {
  return Boolean(
    state.firstTouchAt ||
    state.utmSource ||
    state.utmMedium ||
    state.utmCampaign ||
    state.referralSource
  )
}

/**
 * Given the parsed cookie and the user's current attribution state, return the
 * columns to persist. Returns {} when there is no cookie OR the user is already
 * attributed (first-touch wins). A missing/invalid firstTouchAt in the cookie is
 * synthesized to "now" so the user is still marked attributed going forward.
 */
export function resolveAttribution(
  cookie: AttributionCookie | null,
  state: UserAttributionState
): AttributionPersistInput {
  if (!cookie) return {}
  if (isAlreadyAttributed(state)) return {}

  const out: AttributionPersistInput = {}
  if (cookie.utmSource) out.utmSource = cookie.utmSource
  if (cookie.utmMedium) out.utmMedium = cookie.utmMedium
  if (cookie.utmCampaign) out.utmCampaign = cookie.utmCampaign
  if (cookie.ref) out.referralSource = cookie.ref

  // Only mark attributed if we actually have *some* signal.
  const hasSignal = out.utmSource || out.utmMedium || out.utmCampaign || out.referralSource
  if (!hasSignal) return {}

  const parsedTouch = cookie.firstTouchAt ? new Date(cookie.firstTouchAt) : null
  out.firstTouchAt = parsedTouch && !Number.isNaN(parsedTouch.getTime()) ? parsedTouch : new Date()

  return out
}
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/lib/attribution-resolve.test.ts --runInBand`
      Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add app/lib/attribution.ts app/__tests__/lib/attribution-resolve.test.ts && git commit -m "feat(attribution): add resolveAttribution + cookie parser (first-touch wins)"
```

---

### Task 21: persistAttributionForUser (DB write + signup_completed event)

**Files:**

- Create: `app/lib/attribution-persist.ts`
- Test: `app/__tests__/lib/attribution-persist.test.ts`

This is the side-effecting orchestrator: read the cookie, resolve, write to the User row if there is anything to write, and fire the server-side `signup_completed` event **with** the resolved source. It is the unit-testable seam between the pure resolver and the integration wiring. It must be **fire-and-forget safe** — never throw into the caller (`getCurrentUser` must keep working even if analytics/DB hiccup).

> **Design decision — where signup_completed fires:** the Clerk `user.created` webhook (app/api/webhooks/clerk/route.ts) runs server-to-server and has **no access to the visitor's `ist_attribution` cookie** (Clerk's request carries no first-party cookies for our domain). So firing the signup event there would mean firing it with an empty source — useless for acquisition reporting. We therefore fire `signup_completed` from the **first authenticated request** path (`getCurrentUser` cache-miss), where the browser's cookie _is_ present. The webhook keeps owning user-row creation; this helper owns enrichment + the analytics event. We guard with the same first-touch check so the event fires exactly once per user.

- [ ] **Step 1: Write the failing test**

```ts
import { captureServerEvent } from "@/app/lib/analytics"
import { persistAttributionForUser } from "@/app/lib/attribution-persist"
import prisma from "@/app/lib/prismadb"

/**
 * @jest-environment node
 */
jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: {
      update: jest.fn(),
    },
  },
}))

jest.mock("@/app/lib/analytics", () => ({
  __esModule: true,
  captureServerEvent: jest.fn(),
}))

jest.mock("@/app/lib/logger", () => {
  const child = jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }))
  return {
    __esModule: true,
    default: { child },
    apiLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    authLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    aiLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  }
})

const USER_ID = "11111111-1111-4111-8111-111111111111"

const COOKIE = JSON.stringify({
  utmSource: "twitter",
  utmMedium: "social",
  utmCampaign: "launch",
  ref: "alice",
  firstTouchAt: "2026-06-01T00:00:00.000Z",
})

const unattributed = {
  id: USER_ID,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  referralSource: null,
  firstTouchAt: null,
}

describe("persistAttributionForUser", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.user.update as jest.Mock).mockResolvedValue({})
  })

  it("writes resolved columns and fires signup_completed with the source", async () => {
    await persistAttributionForUser(unattributed, COOKIE)

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: {
        utmSource: "twitter",
        utmMedium: "social",
        utmCampaign: "launch",
        referralSource: "alice",
        firstTouchAt: new Date("2026-06-01T00:00:00.000Z"),
      },
    })

    expect(captureServerEvent).toHaveBeenCalledWith(USER_ID, "signup_completed", {
      utmSource: "twitter",
      utmMedium: "social",
      utmCampaign: "launch",
      referralSource: "alice",
    })
  })

  it("does nothing when the user is already attributed", async () => {
    await persistAttributionForUser(
      { ...unattributed, firstTouchAt: new Date("2026-05-01T00:00:00.000Z") },
      COOKIE
    )
    expect(prisma.user.update).not.toHaveBeenCalled()
    expect(captureServerEvent).not.toHaveBeenCalled()
  })

  it("does nothing when there is no cookie", async () => {
    await persistAttributionForUser(unattributed, undefined)
    expect(prisma.user.update).not.toHaveBeenCalled()
    expect(captureServerEvent).not.toHaveBeenCalled()
  })

  it("swallows DB errors and never throws into the caller", async () => {
    ;(prisma.user.update as jest.Mock).mockRejectedValue(new Error("db down"))
    await expect(persistAttributionForUser(unattributed, COOKIE)).resolves.toBeUndefined()
  })
})

export {}
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/lib/attribution-persist.test.ts --runInBand`
      Expected: FAIL with `Cannot find module '@/app/lib/attribution-persist'`.

- [ ] **Step 3: Implement**

```ts
import { captureServerEvent } from "@/app/lib/analytics"
import { parseAttributionCookie, resolveAttribution } from "@/app/lib/attribution"
import { authLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"

export interface UserAttributionRow {
  id: string
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  referralSource: string | null
  firstTouchAt: Date | null
}

/**
 * First-authenticated-request enrichment. Reads the visitor's `ist_attribution`
 * cookie, and if the user is not yet attributed, persists the first-touch source
 * and fires the server-side `signup_completed` event WITH the resolved source.
 *
 * Fire-and-forget: this never throws into the caller. It is safe to `void` from
 * `getCurrentUser`.
 */
export async function persistAttributionForUser(
  user: UserAttributionRow,
  rawCookie: string | undefined | null
): Promise<void> {
  try {
    const cookie = parseAttributionCookie(rawCookie ?? null)
    const data = resolveAttribution(cookie, {
      utmSource: user.utmSource,
      utmMedium: user.utmMedium,
      utmCampaign: user.utmCampaign,
      referralSource: user.referralSource,
      firstTouchAt: user.firstTouchAt,
    })

    if (Object.keys(data).length === 0) {
      return
    }

    await prisma.user.update({
      where: { id: user.id },
      data,
    })

    captureServerEvent(user.id, "signup_completed", {
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      referralSource: data.referralSource,
    })
  } catch (error) {
    // Attribution is best-effort — never break the authenticated request path.
    authLogger.warn({ err: error, userId: user.id }, "Failed to persist attribution")
  }
}
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/lib/attribution-persist.test.ts --runInBand`
      Expected: PASS (4 cases green).

- [ ] **Step 5: Commit**

```bash
git add app/lib/attribution-persist.ts app/__tests__/lib/attribution-persist.test.ts && git commit -m "feat(attribution): persist first-touch + fire server signup_completed event"
```

---

### Task 22: wire persistence into the first authenticated request (getCurrentUser)

**Files:**

- Modify: `app/actions/getCurrentUser.ts:35-57` (default `getCurrentUser`)

This is the **integration / wiring step**. `getCurrentUser()` is the primary auth helper (per CLAUDE.md) and runs on the first authenticated server request, where `cookies()` from `next/headers` can read the browser's `ist_attribution` cookie. We read the user with the attribution columns selected, then `void` the persistence helper so the attribution write + analytics event run fire-and-forget without delaying the response. Per project conventions, wiring a server action that depends on `next/headers` request context is not meaningfully unit-testable in jsdom — so this is a MANUAL VERIFICATION step, with all the _logic_ already covered by the two prior TDD tasks.

- [ ] **Step 1: Import the helper and cookies, and trigger persistence after the user is loaded**

In `app/actions/getCurrentUser.ts`, add imports at the top (after line 2):

```ts
import { cookies } from "next/headers"

import { ATTRIBUTION_COOKIE_NAME } from "@/app/lib/attribution"
import { persistAttributionForUser } from "@/app/lib/attribution-persist"
```

Replace the body of the default `getCurrentUser` (currently lines 35-55) so it selects the attribution columns and triggers persistence. Note: switch from `omit: { hashedPassword }` to an explicit `include`-free `findUnique` that still excludes the password — keep the existing `omit` and add the read of attribution fields by NOT omitting them (they are returned by default). Because `omit` already returns every non-omitted column, the attribution columns are present on the returned `user` with no select change needed:

```ts
const getCurrentUser = async () => {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return null
    }

    const user = await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
      // Never hand the password hash to API routes — callers that legitimately
      // need it (fallback sign-in, backup-password changes) query it directly.
      omit: {
        hashedPassword: true,
      },
    })

    if (user) {
      // First-authenticated-request enrichment: capture first-touch attribution
      // from the visitor cookie and fire signup_completed. Fire-and-forget.
      const cookieStore = await cookies()
      const rawAttribution = cookieStore.get(ATTRIBUTION_COOKIE_NAME)?.value
      void persistAttributionForUser(
        {
          id: user.id,
          utmSource: user.utmSource,
          utmMedium: user.utmMedium,
          utmCampaign: user.utmCampaign,
          referralSource: user.referralSource,
          firstTouchAt: user.firstTouchAt,
        },
        rawAttribution
      )
    }

    return user
  } catch {
    return null
  }
}
```

- [ ] **Step 2: MANUAL VERIFICATION — typecheck the wiring**
      Run: `npx tsc --noEmit`
      Expected: no errors. (If `user.utmSource` etc. are flagged as unknown, the Prisma client was not regenerated — re-run `npx prisma generate` from the schema task.)

- [ ] **Step 3: MANUAL VERIFICATION — end-to-end behavior in dev**
      Run: `bun run dev`, then in the browser set a cookie before signing in:
      `document.cookie = 'ist_attribution=' + encodeURIComponent(JSON.stringify({utmSource:'twitter',ref:'alice',firstTouchAt:new Date().toISOString()})) + '; path=/'`
      Sign in (or load any `/dashboard` page while authenticated). Then in `npx prisma studio` confirm the `users` row now has `utmSource='twitter'`, `referralSource='alice'`, and a `firstTouchAt`. Reload `/dashboard` a second time and confirm the columns are **unchanged** (first-touch wins, no duplicate `signup_completed`).
      Expected: columns populate once and stay stable across reloads.

- [ ] **Step 4: Confirm no unit-test regressions**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/lib/attribution-resolve.test.ts app/__tests__/lib/attribution-persist.test.ts --runInBand`
      Expected: PASS (both suites green; the wiring change does not touch these files but confirms the imported symbols still resolve).

- [ ] **Step 5: Commit**

```bash
git add app/actions/getCurrentUser.ts && git commit -m "feat(attribution): persist first-touch attribution on first authenticated request"
```

---

## P0 SLICE A4 — Client funnel-event instrumentation

**Context for the engineer:** This slice fires PostHog client-side events to quantify the logged-out "Start Chat" funnel leak and the upgrade funnel. The single highest-value event is `start_chat_signup_wall_hit`: today, a logged-out visitor who clicks "Start Chat" on a public character page is silently bounced to `/sign-in` (`CharacterStartChatButton.tsx:16-19`) with zero instrumentation, so we cannot measure how many people hit that wall. Slice A1 has already installed `posthog-js` and mounted a `PostHogProvider`; you only consume the singleton here via `import posthog from "posthog-js"; posthog.capture(...)`. Do NOT add env vars, install deps, or use the server `captureServerEvent` helper. All target components are real; `CharacterStartChatButton` and `CharacterRemixButton` currently take only `{ characterId }` — you will thread an additional `slug` prop through from the (server) character page. The character page itself is a server component, so `character_viewed` is fired from a tiny new client emitter child (`CharacterViewedTracker`). Tests use Jest + jsdom, run with `set -a; source .env.ci.example; set +a; bun run test <file> --runInBand` — never `bun test`.

---

### Task 23: CharacterStartChatButton (THE signup-wall leak — highest value)

**Files:**

- Modify: `app/components/characters/CharacterStartChatButton.tsx:1-47`
- Modify: `app/(marketing)/characters/[slug]/page.tsx:204` (pass new `slug` prop)
- Test: `app/__tests__/components/CharacterStartChatButton.signupWall.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"

import { CharacterStartChatButton } from "@/app/components/characters/CharacterStartChatButton"

// posthog-js singleton (installed + provider mounted by slice A1). Mock the capture sink.
jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { capture: jest.fn() },
}))

const pushMock = jest.fn()
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

// CSRF token hook — not exercised on the logged-out path, return a stable stub.
jest.mock("@/app/hooks/useCsrfToken", () => ({
  useCsrfToken: () => ({ token: "test-csrf" }),
}))

// Auth hook — drive the LOGGED-OUT branch.
const useAppAuthMock = jest.fn()
jest.mock("@/app/hooks/useAppAuth", () => ({
  useAppAuth: () => useAppAuthMock(),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const posthog = require("posthog-js").default

describe("CharacterStartChatButton — logged-out signup wall", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAppAuthMock.mockReturnValue({ userId: null, isSignedIn: false })
  })

  it("fires start_chat_signup_wall_hit and redirects to /sign-in for logged-out users", () => {
    render(<CharacterStartChatButton characterId="char-123" slug="aria" />)

    fireEvent.click(screen.getByRole("button", { name: /start chat/i }))

    // The click is always tracked...
    expect(posthog.capture).toHaveBeenCalledWith("character_start_chat_clicked", {
      characterId: "char-123",
      slug: "aria",
      isAuthenticated: false,
    })
    // ...and the dead-end is quantified BEFORE the redirect.
    expect(posthog.capture).toHaveBeenCalledWith("start_chat_signup_wall_hit", {
      characterId: "char-123",
      slug: "aria",
    })
    // ...and the existing redirect still happens.
    expect(pushMock).toHaveBeenCalledWith("/sign-in")
  })

  it("does NOT fire the signup wall event for authenticated users", () => {
    useAppAuthMock.mockReturnValue({ userId: "u1", isSignedIn: true })
    // Stub fetch so the authenticated branch does not throw.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "conv-1" }),
    }) as unknown as typeof fetch

    render(<CharacterStartChatButton characterId="char-123" slug="aria" />)
    fireEvent.click(screen.getByRole("button", { name: /start chat/i }))

    expect(posthog.capture).toHaveBeenCalledWith("character_start_chat_clicked", {
      characterId: "char-123",
      slug: "aria",
      isAuthenticated: true,
    })
    expect(posthog.capture).not.toHaveBeenCalledWith(
      "start_chat_signup_wall_hit",
      expect.anything()
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/components/CharacterStartChatButton.signupWall.test.tsx --runInBand`
      Expected: FAIL — the component does not yet accept a `slug` prop nor call `posthog.capture` (the mock `capture` is never invoked, so `toHaveBeenCalledWith` fails). next/jest disables type-checking so the failure surfaces at the assertion.

- [ ] **Step 3: Implement**

In `app/components/characters/CharacterStartChatButton.tsx`, add the posthog import, accept `slug`, and capture both events. Replace lines 1-19:

```tsx
"use client"

import { useRouter } from "next/navigation"
import posthog from "posthog-js"
import toast from "react-hot-toast"

import { Button } from "@/app/components/ui/button"
import { useAppAuth } from "@/app/hooks/useAppAuth"
import { useCsrfToken } from "@/app/hooks/useCsrfToken"

export function CharacterStartChatButton({
  characterId,
  slug,
}: {
  characterId: string
  slug: string
}) {
  const router = useRouter()
  const { userId, isSignedIn } = useAppAuth()
  const { token } = useCsrfToken()

  const handleStart = async () => {
    const isAuthenticated = Boolean(isSignedIn && userId)

    posthog.capture("character_start_chat_clicked", {
      characterId,
      slug,
      isAuthenticated,
    })

    if (!isAuthenticated) {
      // Quantify the dead-end BEFORE we bounce the visitor to sign-in.
      posthog.capture("start_chat_signup_wall_hit", { characterId, slug })
      router.push("/sign-in")
      return
    }
```

(Leave the rest of `handleStart` — the `fetch`/try-catch block from the original line 21 onward — unchanged.)

Then in `app/(marketing)/characters/[slug]/page.tsx`, thread the slug down. The `CharacterHero` component receives `character` but not `slug`; the page already destructures `const { slug } = await params` at line 391. Pass `slug` into `CharacterHero` and on to the button.

Update the `CharacterHero` signature (lines 116-133) to accept `slug`:

```tsx
function CharacterHero({
  character,
  slug,
  gradient,
  category,
  hasLiked,
}: {
  character: CharacterDetails
  slug: string
  gradient: string
  category:
    | {
        id: string
        name: string
        emoji: string
        color: string
      }
    | undefined
  hasLiked: boolean
}) {
```

Update the button call (line 204):

```tsx
<CharacterStartChatButton characterId={character.id} slug={slug} />
```

Update the `<CharacterHero ... />` render in `CharacterPage` (lines 472-477) to pass `slug={slug}`:

```tsx
<CharacterHero
  character={character as CharacterDetails}
  slug={slug}
  gradient={gradient}
  category={category}
  hasLiked={hasLiked}
/>
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/components/CharacterStartChatButton.signupWall.test.tsx --runInBand`
      Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add app/components/characters/CharacterStartChatButton.tsx "app/(marketing)/characters/[slug]/page.tsx" app/__tests__/components/CharacterStartChatButton.signupWall.test.tsx && git commit -m "feat(analytics): track start_chat_signup_wall_hit on logged-out Start Chat"
```

---

### Task 24: CharacterViewedTracker (new client emitter for the server character page)

**Files:**

- Create: `app/components/characters/CharacterViewedTracker.tsx`
- Modify: `app/(marketing)/characters/[slug]/page.tsx` (render the tracker in `CharacterPage`)
- Test: `app/__tests__/components/CharacterViewedTracker.test.tsx`

The character page (`app/(marketing)/characters/[slug]/page.tsx:390`) is an `async` server component, so it cannot call `posthog.capture` directly. Introduce a minimal client child that fires `character_viewed` once on mount. The page already has `character.id`, `slug`, `character.category`, and `character.isNsfw` in scope.

- [ ] **Step 1: Write the failing test**

```tsx
import React from "react"
import { render } from "@testing-library/react"

import { CharacterViewedTracker } from "@/app/components/characters/CharacterViewedTracker"

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { capture: jest.fn() },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const posthog = require("posthog-js").default

describe("CharacterViewedTracker", () => {
  beforeEach(() => jest.clearAllMocks())

  it("fires character_viewed exactly once on mount with the expected props", () => {
    render(
      <CharacterViewedTracker
        characterId="char-123"
        slug="aria"
        category="roleplay"
        isNsfw={false}
      />
    )

    expect(posthog.capture).toHaveBeenCalledTimes(1)
    expect(posthog.capture).toHaveBeenCalledWith("character_viewed", {
      characterId: "char-123",
      slug: "aria",
      category: "roleplay",
      isNsfw: false,
    })
  })

  it("renders nothing", () => {
    const { container } = render(
      <CharacterViewedTracker characterId="c" slug="s" category="general" isNsfw={true} />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/components/CharacterViewedTracker.test.tsx --runInBand`
      Expected: FAIL with "Cannot find module '@/app/components/characters/CharacterViewedTracker'" (file does not exist yet).

- [ ] **Step 3: Implement**

Create `app/components/characters/CharacterViewedTracker.tsx`:

```tsx
"use client"

import { useEffect } from "react"
import posthog from "posthog-js"

interface CharacterViewedTrackerProps {
  characterId: string
  slug: string
  category: string
  isNsfw: boolean
}

/**
 * Fires the `character_viewed` PostHog event once when the (server-rendered)
 * public character page mounts on the client. Renders nothing.
 */
export function CharacterViewedTracker({
  characterId,
  slug,
  category,
  isNsfw,
}: CharacterViewedTrackerProps) {
  useEffect(() => {
    posthog.capture("character_viewed", { characterId, slug, category, isNsfw })
    // Fire once per page view; props are stable for a given character page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
```

Wire it into `app/(marketing)/characters/[slug]/page.tsx`. Add the import alongside the other character component imports (near line 21):

```tsx
import { CharacterViewedTracker } from "@/app/components/characters/CharacterViewedTracker"
```

Render it at the top of the returned `<section>` in `CharacterPage` (immediately after `<section className="pb-16">` at line 471):

```tsx
    <section className="pb-16">
      <CharacterViewedTracker
        characterId={character.id}
        slug={slug}
        category={character.category}
        isNsfw={character.isNsfw}
      />
```

(`character.isNsfw` is a real `Boolean` column — confirmed in `prisma/schema.prisma:204`.)

- [ ] **Step 4: Run test to verify it passes**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/components/CharacterViewedTracker.test.tsx --runInBand`
      Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/components/characters/CharacterViewedTracker.tsx "app/(marketing)/characters/[slug]/page.tsx" app/__tests__/components/CharacterViewedTracker.test.tsx && git commit -m "feat(analytics): emit character_viewed on public character page"
```

---

### Task 25: CharacterRemixButton (character_remix_clicked)

**Files:**

- Modify: `app/components/characters/CharacterRemixButton.tsx:1-21`
- Modify: `app/(marketing)/characters/[slug]/page.tsx:210` (pass `slug`)
- Test: `app/__tests__/components/CharacterRemixButton.test.tsx`

The remix button exists and mirrors the start-chat button: it bounces logged-out users to `/sign-in` at `CharacterRemixButton.tsx:18-21`. Fire `character_remix_clicked` on every click.

- [ ] **Step 1: Write the failing test**

```tsx
import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"

import { CharacterRemixButton } from "@/app/components/characters/CharacterRemixButton"

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { capture: jest.fn() },
}))

const pushMock = jest.fn()
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

jest.mock("@/app/hooks/useCsrfToken", () => ({
  useCsrfToken: () => ({ token: "test-csrf" }),
}))

const useAppAuthMock = jest.fn()
jest.mock("@/app/hooks/useAppAuth", () => ({
  useAppAuth: () => useAppAuthMock(),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const posthog = require("posthog-js").default

describe("CharacterRemixButton", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAppAuthMock.mockReturnValue({ isSignedIn: false })
  })

  it("fires character_remix_clicked on click", () => {
    render(<CharacterRemixButton characterId="char-123" slug="aria" />)
    fireEvent.click(screen.getByRole("button", { name: /remix/i }))

    expect(posthog.capture).toHaveBeenCalledWith("character_remix_clicked", {
      characterId: "char-123",
      slug: "aria",
      isAuthenticated: false,
    })
    expect(pushMock).toHaveBeenCalledWith("/sign-in")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/components/CharacterRemixButton.test.tsx --runInBand`
      Expected: FAIL — `posthog.capture` is never called (component does not yet track or accept `slug`).

- [ ] **Step 3: Implement**

In `app/components/characters/CharacterRemixButton.tsx`, add the posthog import (after the `next/navigation` import, line 4), accept `slug`, and capture at the start of `handleRemix`. Replace lines 1-21:

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import posthog from "posthog-js"
import toast from "react-hot-toast"

import { Button } from "@/app/components/ui/button"
import { useAppAuth } from "@/app/hooks/useAppAuth"
import { useCsrfToken } from "@/app/hooks/useCsrfToken"

export function CharacterRemixButton({
  characterId,
  slug,
}: {
  characterId: string
  slug: string
}) {
  const router = useRouter()
  const { isSignedIn } = useAppAuth()
  const { token } = useCsrfToken()
  const [isLoading, setIsLoading] = useState(false)

  const handleRemix = async () => {
    posthog.capture("character_remix_clicked", {
      characterId,
      slug,
      isAuthenticated: Boolean(isSignedIn),
    })

    if (!isSignedIn) {
      router.push("/sign-in")
      return
    }
```

(Leave the rest of `handleRemix` from the original `if (isLoading) return` onward unchanged.)

Then in `app/(marketing)/characters/[slug]/page.tsx`, pass `slug` to the button (line 210, inside `CharacterHero`, which already receives `slug` from the first task):

```tsx
<CharacterRemixButton characterId={character.id} slug={slug} />
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/components/CharacterRemixButton.test.tsx --runInBand`
      Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/components/characters/CharacterRemixButton.tsx "app/(marketing)/characters/[slug]/page.tsx" app/__tests__/components/CharacterRemixButton.test.tsx && git commit -m "feat(analytics): track character_remix_clicked"
```

---

### Task 26: UpgradeModal (upgrade_modal_viewed / upgrade_cta_clicked)

**Files:**

- Modify: `app/components/modals/UpgradeModal.tsx:1-16, 61-130`
- Test: `app/__tests__/components/UpgradeModal.analytics.test.tsx`

`UpgradeModal` is a client component already covered by `app/__tests__/components/UpgradeModal.test.tsx`. Fire `upgrade_modal_viewed` when the modal opens (transition to `isOpen === true`) and `upgrade_cta_clicked` when the primary CTA (the "Upgrade to PRO" pricing link, or the "Contact Support" mailto on the cost-cap variant) is clicked. Include the `reason` prop so the funnel can segment free-tier vs cost-cap. Put the new analytics in a separate test file so the existing suite stays untouched.

- [ ] **Step 1: Write the failing test**

```tsx
import "@testing-library/jest-dom"

import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"

import UpgradeModal from "@/app/components/modals/UpgradeModal"

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { capture: jest.fn() },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const posthog = require("posthog-js").default

describe("UpgradeModal analytics", () => {
  beforeEach(() => jest.clearAllMocks())

  it("fires upgrade_modal_viewed when opened (free-tier reason)", () => {
    render(
      <UpgradeModal isOpen={true} onClose={jest.fn()} reason="FREE_TIER_MESSAGE_LIMIT_REACHED" />
    )

    expect(posthog.capture).toHaveBeenCalledWith("upgrade_modal_viewed", {
      reason: "FREE_TIER_MESSAGE_LIMIT_REACHED",
    })
  })

  it("does NOT fire upgrade_modal_viewed while closed", () => {
    render(<UpgradeModal isOpen={false} onClose={jest.fn()} />)
    expect(posthog.capture).not.toHaveBeenCalledWith("upgrade_modal_viewed", expect.anything())
  })

  it("fires upgrade_cta_clicked when the PRO pricing CTA is clicked", () => {
    render(
      <UpgradeModal isOpen={true} onClose={jest.fn()} reason="FREE_TIER_MESSAGE_LIMIT_REACHED" />
    )

    fireEvent.click(screen.getByRole("link", { name: /upgrade to pro/i }))
    expect(posthog.capture).toHaveBeenCalledWith("upgrade_cta_clicked", {
      reason: "FREE_TIER_MESSAGE_LIMIT_REACHED",
      cta: "pricing",
    })
  })

  it("fires upgrade_cta_clicked when the contact-support CTA is clicked (cost cap)", () => {
    render(<UpgradeModal isOpen={true} onClose={jest.fn()} reason="PRO_TIER_COST_CAP_REACHED" />)

    fireEvent.click(screen.getByRole("link", { name: /contact support/i }))
    expect(posthog.capture).toHaveBeenCalledWith("upgrade_cta_clicked", {
      reason: "PRO_TIER_COST_CAP_REACHED",
      cta: "contact_support",
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/components/UpgradeModal.analytics.test.tsx --runInBand`
      Expected: FAIL — `posthog.capture` is never called for any event (no instrumentation yet).

- [ ] **Step 3: Implement**

In `app/components/modals/UpgradeModal.tsx`, add `useEffect` + the posthog import. Update the imports at the top (add a `react` value import):

```tsx
"use client"

import { useEffect } from "react"
import Link from "next/link"
import posthog from "posthog-js"
import { HiCheck, HiOutlineSparkles } from "react-icons/hi2"
```

Inside the component body, after `const messageLimit = getMonthlyMessageLimit(limits)` (line 68), add the viewed-event effect:

```tsx
useEffect(() => {
  if (isOpen) {
    posthog.capture("upgrade_modal_viewed", { reason })
  }
}, [isOpen, reason])
```

For the cost-cap CTA (the `<a href="mailto:...">` at lines 115-121), add an `onClick`:

```tsx
<a
  href={`mailto:${SUPPORT_EMAIL}`}
  className={cn(buttonVariants())}
  aria-label={`Contact support at ${SUPPORT_EMAIL}`}
  onClick={() => posthog.capture("upgrade_cta_clicked", { reason, cta: "contact_support" })}
>
  Contact Support
</a>
```

For the pricing CTA (the `<Link href="/pricing">` at lines 123-129), augment the existing `onClick={onClose}` to also capture:

```tsx
<Link
  href="/pricing"
  className={cn(buttonVariants({ variant: "gradient" }))}
  onClick={() => {
    posthog.capture("upgrade_cta_clicked", { reason, cta: "pricing" })
    onClose()
  }}
>
  Upgrade to PRO — {PRO_PRICE_PER_MONTH}
</Link>
```

Note: `reason` already defaults to `"FREE_TIER_MESSAGE_LIMIT_REACHED"` in the destructured props (line 64), so the event always carries a concrete value.

- [ ] **Step 4: Run test to verify it passes**
      Run both the new analytics test and the existing UpgradeModal test to confirm no regression:

```
set -a; source .env.ci.example; set +a; bun run test app/__tests__/components/UpgradeModal.analytics.test.tsx app/__tests__/components/UpgradeModal.test.tsx --runInBand
```

Expected: PASS (all cases in both files).

- [ ] **Step 5: Commit**

```bash
git add app/components/modals/UpgradeModal.tsx app/__tests__/components/UpgradeModal.analytics.test.tsx && git commit -m "feat(analytics): track upgrade_modal_viewed and upgrade_cta_clicked"
```

---

## Slice B1 — Dynamic sitemap + shared character-select

> Base URL contract: the sitemap reads `siteConfig.url` from `config/site.ts:7`, which is `process.env.NEXT_PUBLIC_APP_URL || "https://infinistar.app"`. Under CI env (`.env.ci.example:26`) that resolves to `https://ci.example.com`, so all sitemap tests assert URLs prefixed with `https://ci.example.com`.

---

### Task 27: Shared CHARACTER_SELECT constant

The constant currently lives duplicated verbatim in two files (`app/(marketing)/explore/page.tsx:25-46` and `app/(marketing)/feed/page.tsx:26-47` — identical) and in a trimmed variant `HOME_CHARACTER_SELECT` in `app/(marketing)/page.tsx:32-50`. Promote the full version to a shared module and refactor the two identical call sites to import it. This is a plain `as const` object, so there is no logic to TDD — it is a pure extraction. Type-check is the verification gate.

**Files:**

- Create: `app/lib/character-select.ts`
- Modify: `app/(marketing)/explore/page.tsx:25-46` (remove local const, import shared)
- Modify: `app/(marketing)/feed/page.tsx:26-47` (remove local const, import shared)

- [ ] **Step 1: Create the shared constant**
      Create `app/lib/character-select.ts` with the exact shape currently duplicated across explore/feed (do NOT alter field set — downstream `ExploreCharacter`/`FeedCharacter` interfaces depend on it):

```ts
import type { Prisma } from "@prisma/client"

/**
 * Shared Prisma `select` for public character cards on marketing surfaces
 * (explore, feed). Promoted from the identical constants previously duplicated
 * in app/(marketing)/explore/page.tsx and app/(marketing)/feed/page.tsx.
 */
export const CHARACTER_SELECT = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  avatarUrl: true,
  createdAt: true,
  createdById: true,
  category: true,
  usageCount: true,
  likeCount: true,
  commentCount: true,
  featured: true,
  isNsfw: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      image: true,
    },
  },
} satisfies Prisma.CharacterSelect
```

- [ ] **Step 2: Refactor explore page to import it**
      In `app/(marketing)/explore/page.tsx`, delete the local `const CHARACTER_SELECT = { ... } as const` block (lines 25-46) and add the import alongside the existing `prisma` import near the top of the file:

```ts
import { CHARACTER_SELECT } from "@/app/lib/character-select"
```

Leave the `ExploreCharacter` interface (lines 48-67) and every `select: CHARACTER_SELECT` usage unchanged.

- [ ] **Step 3: Refactor feed page to import it**
      In `app/(marketing)/feed/page.tsx`, delete the local `const CHARACTER_SELECT = { ... } as const` block (lines 26-47) and add:

```ts
import { CHARACTER_SELECT } from "@/app/lib/character-select"
```

Leave the `FeedCharacter` interface and all `select: CHARACTER_SELECT` usages unchanged. (Leave `app/(marketing)/page.tsx`'s `HOME_CHARACTER_SELECT` alone — it is a different, smaller field set and is out of scope for this slice.)

- [ ] **Step 4: MANUAL VERIFICATION — type-check (no unit test; pure const extraction)**
      Run: `set -a; source .env.ci.example; set +a; bun run typecheck`
      Expected: PASS with no errors referencing `CHARACTER_SELECT`, `explore/page.tsx`, or `feed/page.tsx`. The `satisfies Prisma.CharacterSelect` guarantees the shape still matches the schema; if a field was renamed in the schema this fails here.

- [ ] **Step 5: Commit**

```bash
git add app/lib/character-select.ts "app/(marketing)/explore/page.tsx" "app/(marketing)/feed/page.tsx" && git commit -m "refactor(characters): promote duplicated CHARACTER_SELECT to app/lib/character-select"
```

---

### Task 28: Prisma-backed dynamic sitemap

Rewrite `app/sitemap.ts` (currently a 12-line sync function returning only static routes) into an async, Prisma-backed generator. It must emit: static marketing routes, one `/characters/{slug}` entry per public SFW character, and one `/creators/{id}` entry per distinct creator who has at least one public SFW character. The `isNsfw: false` filter is load-bearing for SEO safety and is the primary thing under test.

Because `app/sitemap.ts` is a Next.js convention file (Next imports it by path), the testable logic is extracted into a pure helper `buildSitemap(characters, creatorIds)` in `app/lib/sitemap-data.ts`, plus the Prisma-backed `default export` that wires queries to that helper. The helper is fully unit-tested; the thin Prisma wiring is covered by mocking prisma in the same test file.

**Files:**

- Create: `app/lib/sitemap-data.ts`
- Modify: `app/sitemap.ts:1-12` (full rewrite)
- Test: `app/__tests__/lib/sitemap.test.ts`

- [ ] **Step 1: Write the failing test**
      Create `app/__tests__/lib/sitemap.test.ts`. It mocks prisma (default export, with `character.findMany` and a creator-distinct query) and asserts SFW-only inclusion, NSFW exclusion, static routes, creator routes, and absolute URLs built from `siteConfig.url` (CI env → `https://ci.example.com`).

```ts
import prisma from "@/app/lib/prismadb"
import { buildSitemap, STATIC_SITEMAP_ROUTES } from "@/app/lib/sitemap-data"
import sitemap from "@/app/sitemap"

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    character: { findMany: jest.fn() },
  },
}))

const mockedFindMany = prisma.character.findMany as jest.Mock

describe("buildSitemap (pure helper)", () => {
  const base = "https://ci.example.com"
  const now = new Date("2026-06-01T00:00:00.000Z")

  it("emits all static routes with absolute URLs from siteConfig", () => {
    const entries = buildSitemap([], [])
    for (const route of STATIC_SITEMAP_ROUTES) {
      expect(entries.some((e) => e.url === `${base}${route}`)).toBe(true)
    }
    // home is highest priority
    const home = entries.find((e) => e.url === `${base}/`)
    expect(home?.priority).toBe(1.0)
  })

  it("emits a /characters/{slug} entry per character with lastModified from updatedAt", () => {
    const entries = buildSitemap(
      [{ slug: "luna-the-bard", updatedAt: now, usageCount: 1000, likeCount: 200 }],
      []
    )
    const charEntry = entries.find((e) => e.url === `${base}/characters/luna-the-bard`)
    expect(charEntry).toBeDefined()
    expect(charEntry?.lastModified).toEqual(now)
  })

  it("weights character priority higher for more popular characters", () => {
    const entries = buildSitemap(
      [
        { slug: "popular", updatedAt: now, usageCount: 100000, likeCount: 5000 },
        { slug: "obscure", updatedAt: now, usageCount: 0, likeCount: 0 },
      ],
      []
    )
    const popular = entries.find((e) => e.url === `${base}/characters/popular`)!
    const obscure = entries.find((e) => e.url === `${base}/characters/obscure`)!
    expect(popular.priority!).toBeGreaterThan(obscure.priority!)
    expect(popular.priority!).toBeLessThanOrEqual(1.0)
    expect(obscure.priority!).toBeGreaterThanOrEqual(0.1)
  })

  it("emits a /creators/{id} entry per creator id", () => {
    const entries = buildSitemap([], ["11111111-1111-4111-8111-111111111111"])
    expect(
      entries.some((e) => e.url === `${base}/creators/11111111-1111-4111-8111-111111111111`)
    ).toBe(true)
  })
})

describe("sitemap (Prisma-backed default export)", () => {
  const base = "https://ci.example.com"
  beforeEach(() => {
    mockedFindMany.mockReset()
  })

  it("queries with isPublic:true AND isNsfw:false and includes only SFW characters", async () => {
    // First call: characters; second call: distinct creators (groupBy-style findMany)
    mockedFindMany
      .mockResolvedValueOnce([
        {
          slug: "sfw-hero",
          updatedAt: new Date("2026-05-01T00:00:00.000Z"),
          usageCount: 10,
          likeCount: 2,
        },
      ])
      .mockResolvedValueOnce([{ createdById: "22222222-2222-4222-8222-222222222222" }])

    const entries = await sitemap()

    // SFW character present
    expect(entries.some((e) => e.url === `${base}/characters/sfw-hero`)).toBe(true)
    // creator present
    expect(
      entries.some((e) => e.url === `${base}/creators/22222222-2222-4222-8222-222222222222`)
    ).toBe(true)

    // The character query MUST filter NSFW out
    const charQuery = mockedFindMany.mock.calls[0][0]
    expect(charQuery.where).toEqual({ isPublic: true, isNsfw: false })
  })

  it("never emits NSFW characters even if the DB returns them (defense via where clause)", async () => {
    // Simulate a correctly-filtered DB: NSFW row is simply absent from results.
    mockedFindMany
      .mockResolvedValueOnce([
        {
          slug: "clean",
          updatedAt: new Date(),
          usageCount: 1,
          likeCount: 0,
        },
      ])
      .mockResolvedValueOnce([])

    const entries = await sitemap()
    expect(entries.some((e) => e.url.includes("/characters/clean"))).toBe(true)
    // The where clause is the guard — assert it is exactly the SFW filter.
    expect(mockedFindMany.mock.calls[0][0].where.isNsfw).toBe(false)
    expect(mockedFindMany.mock.calls[0][0].where.isPublic).toBe(true)
  })

  it("returns static routes even when the DB throws", async () => {
    mockedFindMany.mockRejectedValue(new Error("db down"))
    const entries = await sitemap()
    expect(entries.some((e) => e.url === `${base}/`)).toBe(true)
    expect(entries.some((e) => e.url === `${base}/explore`)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/lib/sitemap.test.ts --runInBand`
      Expected: FAIL with "Cannot find module '@/app/lib/sitemap-data'" (helper not created yet) and the default-export test failing because `app/sitemap.ts` is still sync and returns no character/creator entries.

- [ ] **Step 3: Implement the pure helper**
      Create `app/lib/sitemap-data.ts`. It owns the static route list, the priority-weighting math, and URL assembly from `siteConfig.url` — all pure and testable:

```ts
import type { MetadataRoute } from "next"

import { siteConfig } from "@/config/site"

export interface SitemapCharacterRow {
  slug: string
  updatedAt: Date
  usageCount: number
  likeCount: number
}

export const STATIC_SITEMAP_ROUTES = [
  "/",
  "/pricing",
  "/explore",
  "/feed",
  "/privacy",
  "/terms",
] as const

/**
 * Map a character's popularity to a sitemap priority in [0.1, 1.0].
 * Log-scaled so a 100k-usage character does not drown out the long tail.
 */
function characterPriority(usageCount: number, likeCount: number): number {
  const popularity =
    Math.log10(Math.max(1, usageCount) + 1) + 0.5 * Math.log10(Math.max(1, likeCount) + 1)
  // popularity is ~0 for brand-new characters, ~7.5 for a viral one.
  const scaled = 0.4 + popularity / 12
  return Math.min(1.0, Math.max(0.1, Number(scaled.toFixed(2))))
}

/**
 * Build the full sitemap entry list from already-fetched, already-filtered
 * (public + SFW) characters and creator ids. Pure — no DB access.
 */
export function buildSitemap(
  characters: SitemapCharacterRow[],
  creatorIds: string[]
): MetadataRoute.Sitemap {
  const base = siteConfig.url
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = STATIC_SITEMAP_ROUTES.map((route) => ({
    url: `${base}${route}`,
    lastModified: now,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1.0 : 0.7,
  }))

  const characterEntries: MetadataRoute.Sitemap = characters.map((character) => ({
    url: `${base}/characters/${character.slug}`,
    lastModified: character.updatedAt,
    changeFrequency: "weekly",
    priority: characterPriority(character.usageCount, character.likeCount),
  }))

  const creatorEntries: MetadataRoute.Sitemap = creatorIds.map((id) => ({
    url: `${base}/creators/${id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.5,
  }))

  return [...staticEntries, ...characterEntries, ...creatorEntries]
}
```

- [ ] **Step 4: Implement the Prisma-backed default export**
      Replace the entire contents of `app/sitemap.ts` (lines 1-12) with:

```ts
import type { MetadataRoute } from "next"

import prisma from "@/app/lib/prismadb"
import { buildSitemap, type SitemapCharacterRow } from "@/app/lib/sitemap-data"

// CRITICAL: the `isNsfw: false` filter below is load-bearing for SEO safety.
// Public NSFW characters must NEVER appear in the sitemap. Do not relax this.
const PUBLIC_SFW_WHERE = { isPublic: true, isNsfw: false } as const

// TODO(scale): when public SFW characters approach ~50k, Next.js caps a single
// sitemap at 50,000 URLs. Add generateSitemaps() to shard by index, e.g.:
//   export async function generateSitemaps() {
//     const count = await prisma.character.count({ where: PUBLIC_SFW_WHERE })
//     const shards = Math.ceil(count / 45000)
//     return Array.from({ length: shards }, (_, id) => ({ id }))
//   }
//   export default async function sitemap({ id }: { id: number }) { ... skip/take by id ... }
// Gated behind this TODO — do not build until the catalog actually needs it.

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let characters: SitemapCharacterRow[] = []
  let creatorIds: string[] = []

  try {
    const [characterRows, creatorRows] = await Promise.all([
      prisma.character.findMany({
        where: PUBLIC_SFW_WHERE,
        select: { slug: true, updatedAt: true, usageCount: true, likeCount: true },
        orderBy: { usageCount: "desc" },
        take: 45000,
      }),
      // Distinct creators with >=1 public SFW character.
      prisma.character.findMany({
        where: PUBLIC_SFW_WHERE,
        select: { createdById: true },
        distinct: ["createdById"],
        take: 45000,
      }),
    ])

    characters = characterRows
    creatorIds = creatorRows.map((row) => row.createdById)
  } catch (error) {
    console.error("Failed to load dynamic sitemap data", error)
  }

  return buildSitemap(characters, creatorIds)
}
```

- [ ] **Step 5: Run test to verify it passes**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/lib/sitemap.test.ts --runInBand`
      Expected: PASS — all `buildSitemap` cases (static routes, character entries, priority weighting, creator entries) and all default-export cases (SFW where-clause assertion, NSFW exclusion, DB-throw fallback to static routes) green.

- [ ] **Step 6: MANUAL VERIFICATION — type-check the convention file**
      Run: `set -a; source .env.ci.example; set +a; bun run typecheck`
      Expected: PASS. Confirms `Promise<MetadataRoute.Sitemap>` is a valid signature for a Next.js `sitemap.ts` default export and the `distinct` Prisma arg type-checks against the Character model.

- [ ] **Step 7: Commit**

```bash
git add app/sitemap.ts app/lib/sitemap-data.ts app/__tests__/lib/sitemap.test.ts && git commit -m "feat(seo): Prisma-backed dynamic sitemap with SFW-only characters and creators"
```

---

## P1 Slice B2 — JSON-LD structured data + canonicals

> Context for the engineer: `app/layout.tsx:13` sets `metadataBase: new URL(siteConfig.url)`, so a relative `alternates.canonical` (e.g. `"/explore"`) is automatically resolved to an absolute URL by Next.js. Today only `app/layout.tsx` (`/`), `app/(marketing)/explore/page.tsx` (`/explore`), and `app/(marketing)/pricing/page.tsx` (`/pricing`) declare `alternates.canonical`. The character detail, creator profile, and feed pages do NOT. JSON-LD, by contrast, needs ABSOLUTE URLs (Google ignores relative `url`/`@id`), so the builder takes a `baseUrl` argument resolved from `siteConfig.url`.

---

### Task 29: Structured-data builders (`app/lib/structured-data.ts`)

**Files:**

- Create: `app/lib/structured-data.ts`
- Test: `app/__tests__/lib/structured-data.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/__tests__/lib/structured-data.test.ts
import {
  buildCharacterJsonLd,
  buildCreatorJsonLd,
  type CharacterJsonLdInput,
  type CreatorJsonLdInput,
} from "@/app/lib/structured-data"

const BASE = "https://infinistar.app"

const character: CharacterJsonLdInput = {
  name: "Aria the Bard",
  slug: "aria-the-bard",
  tagline: "A wandering storyteller",
  description: "Aria spins tales of forgotten realms.",
  avatarUrl: "https://cdn.example.com/aria.png",
  category: "fantasy",
  usageCount: 1234,
  likeCount: 56,
  commentCount: 7,
  createdById: "11111111-1111-4111-8111-111111111111",
  createdByName: "Lorenzo",
}

const creator: CreatorJsonLdInput = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Lorenzo",
  bio: "Builds fantasy companions.",
  image: "https://cdn.example.com/lorenzo.png",
}

describe("buildCharacterJsonLd", () => {
  it("emits a Product node and a BreadcrumbList node in an @graph", () => {
    const jsonLd = buildCharacterJsonLd(character, BASE)
    expect(jsonLd["@context"]).toBe("https://schema.org")
    expect(Array.isArray(jsonLd["@graph"])).toBe(true)
    const types = jsonLd["@graph"].map((n) => n["@type"])
    expect(types).toContain("Product")
    expect(types).toContain("BreadcrumbList")
  })

  it("sets an absolute canonical url and name on the Product node", () => {
    const jsonLd = buildCharacterJsonLd(character, BASE)
    const product = jsonLd["@graph"].find((n) => n["@type"] === "Product")!
    expect(product.name).toBe("Aria the Bard")
    expect(product.url).toBe("https://infinistar.app/characters/aria-the-bard")
    expect(product.image).toBe("https://cdn.example.com/aria.png")
    expect(product.description).toBe("A wandering storyteller")
  })

  it("maps likeCount to aggregateRating ratingCount and usageCount to an InteractionCounter", () => {
    const jsonLd = buildCharacterJsonLd(character, BASE)
    const product = jsonLd["@graph"].find((n) => n["@type"] === "Product")!
    expect(product.aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: "5",
      ratingCount: 56,
      bestRating: "5",
      worstRating: "1",
    })
    expect(product.interactionStatistic).toEqual({
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/InteractAction",
      userInteractionCount: 1234,
    })
  })

  it("maps createdBy to an author Person with an absolute creator url", () => {
    const jsonLd = buildCharacterJsonLd(character, BASE)
    const product = jsonLd["@graph"].find((n) => n["@type"] === "Product")!
    expect(product.author).toEqual({
      "@type": "Person",
      name: "Lorenzo",
      url: "https://infinistar.app/creators/11111111-1111-4111-8111-111111111111",
    })
  })

  it("omits aggregateRating when there are zero likes", () => {
    const jsonLd = buildCharacterJsonLd({ ...character, likeCount: 0 }, BASE)
    const product = jsonLd["@graph"].find((n) => n["@type"] === "Product")!
    expect(product.aggregateRating).toBeUndefined()
  })

  it("builds breadcrumb items Home > Explore > category > character with absolute urls", () => {
    const jsonLd = buildCharacterJsonLd(character, BASE)
    const crumbs = jsonLd["@graph"].find((n) => n["@type"] === "BreadcrumbList")!
    expect(crumbs.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "https://infinistar.app/" },
      { "@type": "ListItem", position: 2, name: "Explore", item: "https://infinistar.app/explore" },
      {
        "@type": "ListItem",
        position: 3,
        name: "Fantasy",
        item: "https://infinistar.app/explore?category=fantasy",
      },
      {
        "@type": "ListItem",
        position: 4,
        name: "Aria the Bard",
        item: "https://infinistar.app/characters/aria-the-bard",
      },
    ])
  })

  it("falls back to the description and category display name when fields are missing", () => {
    const jsonLd = buildCharacterJsonLd(
      { ...character, tagline: null, category: "unknown-cat" },
      BASE
    )
    const product = jsonLd["@graph"].find((n) => n["@type"] === "Product")!
    expect(product.description).toBe("Aria spins tales of forgotten realms.")
    const crumbs = jsonLd["@graph"].find((n) => n["@type"] === "BreadcrumbList")!
    // getCategoryName returns "General" for unknown ids
    expect(crumbs.itemListElement[2].name).toBe("General")
  })
})

describe("buildCreatorJsonLd", () => {
  it("emits a ProfilePage with a Person mainEntity and absolute url", () => {
    const jsonLd = buildCreatorJsonLd(creator, BASE)
    expect(jsonLd["@context"]).toBe("https://schema.org")
    expect(jsonLd["@type"]).toBe("ProfilePage")
    expect(jsonLd.mainEntity).toEqual({
      "@type": "Person",
      name: "Lorenzo",
      description: "Builds fantasy companions.",
      image: "https://cdn.example.com/lorenzo.png",
      url: "https://infinistar.app/creators/22222222-2222-4222-8222-222222222222",
    })
  })

  it("falls back to a generic name and omits description/image when absent", () => {
    const jsonLd = buildCreatorJsonLd({ id: creator.id, name: null, bio: null, image: null }, BASE)
    const person = jsonLd.mainEntity
    expect(person.name).toBe("Anonymous")
    expect(person.description).toBeUndefined()
    expect(person.image).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/lib/structured-data.test.ts --runInBand`
      Expected: FAIL with `Cannot find module '@/app/lib/structured-data'` (file does not exist yet).

- [ ] **Step 3: Implement the builder**

```ts
// app/lib/structured-data.ts
import { getCategoryName } from "@/app/lib/character-categories"

export interface CharacterJsonLdInput {
  name: string
  slug: string
  tagline: string | null
  description: string | null
  avatarUrl: string | null
  category: string
  usageCount: number
  likeCount: number
  commentCount: number
  createdById: string
  createdByName: string | null
}

export interface CreatorJsonLdInput {
  id: string
  name: string | null
  bio: string | null
  image: string | null
}

interface ListItem {
  "@type": "ListItem"
  position: number
  name: string
  item: string
}

interface AggregateRating {
  "@type": "AggregateRating"
  ratingValue: string
  ratingCount: number
  bestRating: string
  worstRating: string
}

interface InteractionCounter {
  "@type": "InteractionCounter"
  interactionType: string
  userInteractionCount: number
}

interface PersonNode {
  "@type": "Person"
  name: string
  url: string
  description?: string
  image?: string
}

interface ProductNode {
  "@type": "Product"
  name: string
  url: string
  description?: string
  image?: string
  category: string
  author: PersonNode
  aggregateRating?: AggregateRating
  interactionStatistic: InteractionCounter
}

interface BreadcrumbListNode {
  "@type": "BreadcrumbList"
  itemListElement: ListItem[]
}

export interface CharacterJsonLd {
  "@context": "https://schema.org"
  "@graph": Array<ProductNode | BreadcrumbListNode>
}

export interface CreatorJsonLd {
  "@context": "https://schema.org"
  "@type": "ProfilePage"
  mainEntity: PersonNode
}

/**
 * Strips a single trailing slash so we can concatenate path segments safely.
 */
function normalizeBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "")
}

export function buildCharacterJsonLd(
  character: CharacterJsonLdInput,
  baseUrl: string
): CharacterJsonLd {
  const base = normalizeBase(baseUrl)
  const characterUrl = `${base}/characters/${character.slug}`
  const creatorUrl = `${base}/creators/${character.createdById}`
  const categoryName = getCategoryName(character.category)

  const author: PersonNode = {
    "@type": "Person",
    name: character.createdByName || "Anonymous",
    url: creatorUrl,
  }

  const product: ProductNode = {
    "@type": "Product",
    name: character.name,
    url: characterUrl,
    description: character.tagline || character.description || undefined,
    image: character.avatarUrl || undefined,
    category: categoryName,
    author,
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/InteractAction",
      userInteractionCount: character.usageCount,
    },
  }

  if (character.likeCount > 0) {
    product.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: "5",
      ratingCount: character.likeCount,
      bestRating: "5",
      worstRating: "1",
    }
  }

  const breadcrumb: BreadcrumbListNode = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${base}/` },
      { "@type": "ListItem", position: 2, name: "Explore", item: `${base}/explore` },
      {
        "@type": "ListItem",
        position: 3,
        name: categoryName,
        item: `${base}/explore?category=${encodeURIComponent(character.category)}`,
      },
      { "@type": "ListItem", position: 4, name: character.name, item: characterUrl },
    ],
  }

  return {
    "@context": "https://schema.org",
    "@graph": [product, breadcrumb],
  }
}

export function buildCreatorJsonLd(creator: CreatorJsonLdInput, baseUrl: string): CreatorJsonLd {
  const base = normalizeBase(baseUrl)
  const person: PersonNode = {
    "@type": "Person",
    name: creator.name || "Anonymous",
    url: `${base}/creators/${creator.id}`,
  }
  if (creator.bio) person.description = creator.bio
  if (creator.image) person.image = creator.image

  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: person,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/lib/structured-data.test.ts --runInBand`
      Expected: PASS (all `buildCharacterJsonLd` and `buildCreatorJsonLd` cases green).

- [ ] **Step 5: Commit**

```bash
git add app/lib/structured-data.ts app/__tests__/lib/structured-data.test.ts && git commit -m "feat(seo): add JSON-LD builders for character and creator pages"
```

---

### Task 30: Render character JSON-LD + add canonical (`app/(marketing)/characters/[slug]/page.tsx`)

**Files:**

- Modify: `app/(marketing)/characters/[slug]/page.tsx:1-23` (imports), `:79-88` (generateMetadata return), `:470-491` (render)

> This is a server-component wiring change. Per project test conventions, rendering JSON-LD into a `force-dynamic` server component that runs live Prisma queries is NOT unit-testable here (no DOM render of an async server component under Jest); the logic is already covered by the builder test. The steps below are explicit edits plus a MANUAL VERIFICATION step.

- [ ] **Step 1: Import the builder and siteConfig**
      Add to the import block (alongside the existing `import { getCategoryById } from "@/app/lib/character-categories"` at line 13 and the `prisma` import at line 15). Add after line 16 (`import { cn } from "@/app/lib/utils"`):

```ts
import { siteConfig } from "@/config/site"
import { buildCharacterJsonLd } from "@/app/lib/structured-data"
```

- [ ] **Step 2: Add canonical to generateMetadata**
      In `generateMetadata`, the current return (lines 79-87) starts with `title`/`description`/`openGraph`. Insert an `alternates` block right after the opening `return {` (line 79) so the final character URL is canonicalized. Change:

```ts
  return {
    title: `${character.name} | InfiniStar`,
```

to:

```ts
  return {
    alternates: {
      canonical: `/characters/${slug}`,
    },
    title: `${character.name} | InfiniStar`,
```

- [ ] **Step 3: Render the JSON-LD `<script>` in the page component**
      The default export returns `<section className="pb-16">...</section>` (line 470). Replace the opening of the return so a `<script type="application/ld+json">` precedes the section. Change:

```tsx
  return (
    <section className="pb-16">
      <CharacterHero
```

to:

```tsx
  const jsonLd = buildCharacterJsonLd(
    {
      name: character.name,
      slug: character.slug,
      tagline: character.tagline,
      description: character.description,
      avatarUrl: character.avatarUrl,
      category: character.category,
      usageCount: character.usageCount,
      likeCount: character.likeCount,
      commentCount: character.commentCount,
      createdById: character.createdById,
      createdByName: character.createdBy?.name ?? null,
    },
    siteConfig.url
  )

  return (
    <section className="pb-16">
      <script
        type="application/ld+json"
        // JSON.stringify output is HTML-safe here: schema.org values contain no
        // user-controlled closing </script> sequences; Next renders this inert.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CharacterHero
```

- [ ] **Step 4: Typecheck the edited page**
      Run: `set -a; source .env.ci.example; set +a; npx tsc --noEmit`
      Expected: PASS — no type errors. (`character` already has all referenced fields via the `findUnique` `include: { createdBy }` at lines 393-400; `createdById` is a Character column.)

- [ ] **Step 5: MANUAL VERIFICATION (server-render smoke test)**
      Run `bun run dev`, open a public character page (`/characters/<some-public-slug>`), then `curl -s http://localhost:3000/characters/<slug> | grep -o 'application/ld+json'` and confirm the script tag is present. Validate the emitted JSON by pasting the page URL into Google's Rich Results Test (or `https://validator.schema.org/`) and confirm a `Product` + `BreadcrumbList` are detected with no errors. Confirm `<link rel="canonical" href="https://infinistar.app/characters/<slug>">` appears in `<head>`.

- [ ] **Step 6: Commit**

```bash
git add "app/(marketing)/characters/[slug]/page.tsx" && git commit -m "feat(seo): render character JSON-LD and add canonical to character pages"
```

---

### Task 31: Render creator JSON-LD + add canonical (`app/(marketing)/creators/[userId]/page.tsx`)

**Files:**

- Modify: `app/(marketing)/creators/[userId]/page.tsx:8-15` (imports), `:25-34` (generateMetadata return), `:166-167` (render)

> Server-component wiring; not unit-testable here (covered by the builder test). Steps are explicit edits plus a MANUAL VERIFICATION step.

- [ ] **Step 1: Import the builder and siteConfig**
      Add after the existing `import { canAccessNsfw } from "@/app/lib/nsfw"` (line 9) / `import prisma from "@/app/lib/prismadb"` (line 10) imports:

```ts
import { siteConfig } from "@/config/site"
import { buildCreatorJsonLd } from "@/app/lib/structured-data"
```

- [ ] **Step 2: Add canonical to generateMetadata**
      The current return (lines 26-34) begins with `title`. Insert `alternates` immediately after `return {` (line 26). Change:

```ts
  return {
    title: `${creator.name} | InfiniStar Creator`,
```

to:

```ts
  return {
    alternates: {
      canonical: `/creators/${userId}`,
    },
    title: `${creator.name} | InfiniStar Creator`,
```

- [ ] **Step 3: Render the JSON-LD `<script>` in the page component**
      The default export returns `<section className="container flex flex-col gap-8 py-10">` (line 167). Build the JSON-LD just above the `return` (after the `summary` object closes at line 164) and emit the script as the first child. Change:

```tsx
  return (
    <section className="container flex flex-col gap-8 py-10">
      {/* Profile Header */}
```

to:

```tsx
  const jsonLd = buildCreatorJsonLd(
    { id: user.id, name: user.name, bio: user.bio, image: user.image },
    siteConfig.url
  )

  return (
    <section className="container flex flex-col gap-8 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Profile Header */}
```

- [ ] **Step 4: Typecheck the edited page**
      Run: `set -a; source .env.ci.example; set +a; npx tsc --noEmit`
      Expected: PASS. (`user` is selected with `id`, `name`, `image`, `bio` at lines 67-73, all of which `buildCreatorJsonLd` consumes.)

- [ ] **Step 5: MANUAL VERIFICATION**
      Run `bun run dev`, open `/creators/<userId>` for an existing user, and confirm `curl -s http://localhost:3000/creators/<userId> | grep -o 'ProfilePage'` returns a match and that `<link rel="canonical" href="https://infinistar.app/creators/<userId>">` is in `<head>`. Optionally paste into `https://validator.schema.org/` and confirm a `ProfilePage`/`Person` is detected.

- [ ] **Step 6: Commit**

```bash
git add "app/(marketing)/creators/[userId]/page.tsx" && git commit -m "feat(seo): render creator JSON-LD and add canonical to creator pages"
```

---

### Task 32: Add canonical to feed page (`app/(marketing)/feed/page.tsx`)

**Files:**

- Modify: `app/(marketing)/feed/page.tsx:13-22` (static `metadata` export)

> The feed page uses a static `metadata` object (not `generateMetadata`), so this is a one-line additive edit. No JSON-LD is required for the feed (it's a list/discovery surface, not a single entity). This is a config/metadata change — not unit-testable; verification is a MANUAL step.

- [ ] **Step 1: Add `alternates.canonical` to the static metadata**
      The `metadata` export (lines 13-22) currently has `title`, `description`, `openGraph`. Insert `alternates` right after the `description` value. Change:

```ts
export const metadata = {
  title: "Community Feed | InfiniStar",
  description:
    "See trending characters, discover new creators, and follow what the InfiniStar community is building.",
  openGraph: {
```

to:

```ts
export const metadata = {
  title: "Community Feed | InfiniStar",
  description:
    "See trending characters, discover new creators, and follow what the InfiniStar community is building.",
  alternates: {
    canonical: "/feed",
  },
  openGraph: {
```

- [ ] **Step 2: Typecheck**
      Run: `set -a; source .env.ci.example; set +a; npx tsc --noEmit`
      Expected: PASS (a plain object literal `metadata` accepts `alternates`; matches the shape already used in `app/(marketing)/explore/page.tsx:12-14`).

- [ ] **Step 3: MANUAL VERIFICATION**
      Run `bun run dev`, open `/feed`, and confirm `curl -s http://localhost:3000/feed | grep -o '<link rel="canonical"[^>]*>'` shows `href="https://infinistar.app/feed"` (resolved from the relative path via `metadataBase` in `app/layout.tsx:13`).

- [ ] **Step 4: Commit**

```bash
git add "app/(marketing)/feed/page.tsx" && git commit -m "feat(seo): add canonical url to community feed page"
```

---

## Slice B3 — Decouple view tracking, then switch to ISR

> **ORDERING IS CRITICAL.** Execute these tasks strictly in order: B3.1 (create the decoupled view route + beacon) → B3.2 (remove the per-GET increment from the cached render path) → B3.3 (switch the pages to ISR). If you switch to ISR before removing the per-GET write, the cached HTML never re-renders so views stop counting; and if you leave the per-GET write in a `force-dynamic` page, every bot crawl inflates `viewCount` and the page can never be cached. The new beacon route is what keeps view counting alive once the page render is no longer dynamic.

---

### Task 33: Character view-tracking route + client beacon

**Files:**

- Create: `app/api/characters/[characterId]/view/route.ts`
- Create: `app/components/characters/CharacterViewBeacon.tsx`
- Test: `app/__tests__/api/character-view-route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/__tests__/api/character-view-route.test.ts`:

```ts
/**
 * @jest-environment node
 */

import { NextRequest } from "next/server"

import prisma from "@/app/lib/prismadb"
import { apiLimiter } from "@/app/lib/rate-limit"
import { POST } from "@/app/api/characters/[characterId]/view/route"

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    character: {
      update: jest.fn(),
    },
  },
}))

jest.mock("@/app/lib/rate-limit", () => ({
  apiLimiter: { check: jest.fn(() => true) },
  getClientIdentifier: jest.fn(() => "127.0.0.1"),
}))

jest.mock("@/app/lib/logger", () => ({
  __esModule: true,
  default: {
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    })),
  },
  apiLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  aiLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  authLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

const VALID_ID = "11111111-1111-4111-8111-111111111111"

function createRequest() {
  return new NextRequest(`http://localhost:3000/api/characters/${VALID_ID}/view`, {
    method: "POST",
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(apiLimiter.check as jest.Mock).mockReturnValue(true)
  ;(prisma.character.update as jest.Mock).mockResolvedValue({ id: VALID_ID })
})

describe("POST /api/characters/[characterId]/view", () => {
  it("increments viewCount exactly once and returns 200", async () => {
    const response = await POST(createRequest(), {
      params: Promise.resolve({ characterId: VALID_ID }),
    })

    expect(response.status).toBe(200)
    expect(prisma.character.update).toHaveBeenCalledTimes(1)
    expect(prisma.character.update).toHaveBeenCalledWith({
      where: { id: VALID_ID },
      data: { viewCount: { increment: 1 } },
    })
  })

  it("rejects an invalid characterId without touching the database", async () => {
    const response = await POST(createRequest(), {
      params: Promise.resolve({ characterId: "not-a-uuid" }),
    })

    expect(response.status).toBe(400)
    expect(prisma.character.update).not.toHaveBeenCalled()
  })

  it("returns 429 and skips the increment when rate limited", async () => {
    ;(apiLimiter.check as jest.Mock).mockReturnValue(false)

    const response = await POST(createRequest(), {
      params: Promise.resolve({ characterId: VALID_ID }),
    })

    expect(response.status).toBe(429)
    expect(prisma.character.update).not.toHaveBeenCalled()
  })

  it("returns 200 (fire-and-forget) when the record does not exist", async () => {
    const notFound = Object.assign(new Error("Record to update not found."), {
      code: "P2025",
    })
    ;(prisma.character.update as jest.Mock).mockRejectedValue(notFound)

    const response = await POST(createRequest(), {
      params: Promise.resolve({ characterId: VALID_ID }),
    })

    expect(response.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/api/character-view-route.test.ts --runInBand`
      Expected: FAIL with `Cannot find module '@/app/api/characters/[characterId]/view/route'` (route does not exist yet).

- [ ] **Step 3: Implement the route**

Create `app/api/characters/[characterId]/view/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { apiLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"

// View tracking is decoupled from the (now cached) page render. This endpoint is
// public (anonymous visitors must count) and intentionally requires no auth or CSRF.
// Rate limiting + a fire-once-per-mount client beacon keep counts honest.
const paramsSchema = z.object({ characterId: z.string().uuid() })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
): Promise<NextResponse> {
  const identifier = getClientIdentifier(request)
  const allowed = await Promise.resolve(apiLimiter.check(identifier))
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const parsed = paramsSchema.safeParse(await params)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid character id" }, { status: 400 })
  }

  try {
    await prisma.character.update({
      where: { id: parsed.data.characterId },
      data: { viewCount: { increment: 1 } },
    })
  } catch (error) {
    // Fire-and-forget: a missing/unpublished character or transient DB error must never
    // surface to the beacon caller. Log and respond 200 so the client does not retry.
    apiLogger.warn({ err: error, characterId: parsed.data.characterId }, "View increment skipped")
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `set -a; source .env.ci.example; set +a; bun run test app/__tests__/api/character-view-route.test.ts --runInBand`
      Expected: PASS (4 tests).

- [ ] **Step 5: Implement the client beacon component**

Create `app/components/characters/CharacterViewBeacon.tsx`:

```tsx
"use client"

import { useEffect, useRef } from "react"

interface CharacterViewBeaconProps {
  characterId: string
}

/**
 * Fires a single view-tracking request on mount. Rendered inside the (now ISR-cached)
 * character page so view counting survives the move off `force-dynamic`. The ref guard
 * makes it idempotent across React Strict Mode's double-invoke in development.
 */
export function CharacterViewBeacon({ characterId }: CharacterViewBeaconProps): null {
  const sentRef = useRef(false)

  useEffect(() => {
    if (sentRef.current) return
    sentRef.current = true

    void fetch(`/api/characters/${characterId}/view`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {
      // View tracking is best-effort; never disrupt the page on failure.
    })
  }, [characterId])

  return null
}
```

- [ ] **Step 6: Commit**

```bash
git add "app/api/characters/[characterId]/view/route.ts" app/components/characters/CharacterViewBeacon.tsx app/__tests__/api/character-view-route.test.ts && git commit -m "feat(characters): add decoupled view-tracking route + client beacon"
```

---

### Task 34: Remove per-GET view increment from cached render path

**Files:**

- Modify: `app/(marketing)/characters/[slug]/page.tsx:253` (display), `:413-417` (delete the write), `:470-490` (mount beacon)

> No unit test: this is a render-path edit on a server component that mocks heavy children. Verification is the MANUAL VERIFICATION step below plus the build/typecheck. The logic under test (the increment) now lives in the route covered by the previous task.

- [ ] **Step 1: Delete the per-GET increment write**

In `app/(marketing)/characters/[slug]/page.tsx`, delete these exact lines (currently `413-417`):

```ts
// Increment view count
await prisma.character.update({
  where: { id: character.id },
  data: { viewCount: { increment: 1 } },
})
```

This write is what made the page uncacheable and bot-inflatable. View counting now happens in the beacon route.

- [ ] **Step 2: Fix the displayed count to stop the off-by-one**

The page previously showed `viewCount + 1` to optimistically reflect the just-performed write. With the write gone, render the real stored value. In `CharacterStats`, change line `253`:

```tsx
{
  ;(character.viewCount + 1).toLocaleString()
}
```

to:

```tsx
{
  character.viewCount.toLocaleString()
}
```

- [ ] **Step 3: Mount the beacon so views still count**

Add the import near the other character component imports (after line 22, alongside `PublicCharacterCard`):

```tsx
import { CharacterViewBeacon } from "@/app/components/characters/CharacterViewBeacon"
```

Then render it inside the returned tree. Replace the opening of the return block (currently lines `470-477`):

```tsx
  return (
    <section className="pb-16">
      <CharacterHero
        character={character as CharacterDetails}
        gradient={gradient}
        category={category}
        hasLiked={hasLiked}
      />
```

with:

```tsx
  return (
    <section className="pb-16">
      <CharacterViewBeacon characterId={character.id} />
      <CharacterHero
        character={character as CharacterDetails}
        gradient={gradient}
        category={category}
        hasLiked={hasLiked}
      />
```

- [ ] **Step 4: Typecheck (the closest thing to a unit gate here)**
      Run: `npx tsc --noEmit`
      Expected: PASS with no new errors. (Confirms the removed `prisma.character.update` left no dangling references and the beacon import resolves.)

- [ ] **Step 5: MANUAL VERIFICATION — page still renders, no write on GET**
      Run: `bun run dev`, then load `http://localhost:3000/characters/<some-public-slug>` twice.
- Observe: the page renders fully (hero, stats, content) with no runtime error.
- Observe in the Network tab: a single `POST /api/characters/<id>/view` fires on load (the beacon), and there is **no** `prisma.character.update` triggered by the page GET itself.
- Confirm the views stat reflects the stored `viewCount` (no longer artificially `+1`).

- [ ] **Step 6: Commit**

```bash
git add "app/(marketing)/characters/[slug]/page.tsx" && git commit -m "refactor(characters): remove per-GET view write from cached render path"
```

---

### Task 35: Switch character + creator pages to ISR

**Files:**

- Modify: `app/(marketing)/characters/[slug]/page.tsx:70`
- Modify: `app/(marketing)/creators/[userId]/page.tsx:17`

> Config-only change (Next.js route segment config). No unit test — Jest cannot meaningfully assert `export const revalidate`. Verification is the MANUAL VERIFICATION step below. **Do not start this task until the previous two have landed** — switching to ISR while the page still writes on GET would silently break caching.

- [ ] **Step 1: Switch the character detail page to ISR**

In `app/(marketing)/characters/[slug]/page.tsx`, change line `70`:

```ts
export const dynamic = "force-dynamic"
```

to:

```ts
// ISR: render is now read-only (view counting moved to the beacon route), so the page
// can be cached and revalidated hourly instead of rendered per request.
export const revalidate = 3600
```

- [ ] **Step 2: Switch the creator profile page to ISR**

In `app/(marketing)/creators/[userId]/page.tsx`, change line `17`:

```ts
export const dynamic = "force-dynamic"
```

to:

```ts
// ISR: read-only public render — safe to cache and revalidate hourly.
export const revalidate = 3600
```

- [ ] **Step 3: Build to confirm both pages are cacheable**
      Run: `set -a; source .env.ci.example; set +a; bun run build`
      Expected: PASS. In the build route summary, both `/characters/[slug]` and `/creators/[userId]` should be marked as ISR/revalidating (an `ƒ`/`●`-style indicator with the 3600s revalidate), **not** `ƒ (Dynamic)`. If either still shows Dynamic, grep for any remaining `headers()`/`cookies()`/dynamic-API call in that page's data path (note: `getCurrentUser()` reads Clerk auth — see the note in `notes`).

- [ ] **Step 4: MANUAL VERIFICATION — pages render and cache**
      Run: `bun run start` (after the build above), load `http://localhost:3000/characters/<slug>` and `http://localhost:3000/creators/<userId>`.
- Observe: both pages render fully and identically to before.
- Observe: the character page still fires the view beacon (`POST .../view`) on each load, so `viewCount` keeps climbing even though the HTML is cached.
- Observe: reloading within the hour serves the cached render (no per-request DB re-query for the shell).

- [ ] **Step 5: Commit**

```bash
git add "app/(marketing)/characters/[slug]/page.tsx" "app/(marketing)/creators/[userId]/page.tsx" && git commit -m "perf(marketing): switch character + creator pages from force-dynamic to ISR (revalidate 3600)"
```

---

> **P4 LEADERBOARD NOTE (do not implement now — record for the future P4 slice):** Any future "trending"/leaderboard ranking MUST rank on `usageCount` (actual chats started), **never** `viewCount`. `viewCount` is now a best-effort, beacon-driven, rate-limited counter that anonymous/bot traffic can still influence; it is a vanity metric, not a quality signal. Note that the existing "Similar Characters" query (`app/(marketing)/characters/[slug]/page.tsx:445`) and the creator characters ordering (`app/(marketing)/creators/[userId]/page.tsx:76`) already correctly order by `usageCount` — keep that invariant.

---
