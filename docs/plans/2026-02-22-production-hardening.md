# Production Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the three blocking production-readiness issues: CSP/migrations/axios (Phase 1), Form.tsx decomposition (Phase 2), NSFW age gate (Phase 3).

**Architecture:** Sequential phases — each phase commits independently, leaves the app in a working state, and can be verified before proceeding. No new dependencies added.

**Tech Stack:** Next.js 16, TypeScript, Prisma, `app/lib/api-client.ts` (centralized fetch wrapper), Tailwind, Radix UI.

---

## Phase 1 — Quick Wins

### Task 1: Remove personal domain from CSP

**Files:**

- Modify: `next.config.mjs` (lines 59, 72, 90)

**Step 1: Delete the three CSP entries**

In `next.config.mjs`, remove these three lines (one in each directive):

```
line 59:  "https://*.lscaturchio.xyz",    // inside script-src
line 72:  "https://*.lscaturchio.xyz",    // inside img-src
line 90:  "https://*.lscaturchio.xyz",    // inside connect-src
```

Use the Edit tool three times, once per line. Each Edit should remove only that single string from the array.

**Step 2: Verify the app still builds**

```bash
bun run build 2>&1 | tail -20
```

Expected: build succeeds, no CSP-related errors.

**Step 3: Commit**

```bash
git add next.config.mjs
git commit -m "security: remove personal domain from Content Security Policy"
```

---

### Task 2: Add production migrations script

**Files:**

- Modify: `package.json` (scripts section, after line 34)
- Modify: `CLAUDE.md` (Development Commands section)

**Step 1: Add the script**

In `package.json`, add after the `"seed"` line:

```json
"migrate:deploy": "prisma migrate deploy",
```

This script is for production use only. Development stays on `prisma db push`.

**Step 2: Update CLAUDE.md**

In the `## Development Commands` section, after the `npx prisma studio` line add:

```markdown
npx prisma migrate deploy # Apply pending migrations in production (NOT dev)
bun run migrate:deploy # Shorthand for the above
```

And add a note below the Database section:

```markdown
# ⚠️ Production: always use `migrate:deploy`, never `db push`
```

**Step 3: Verify**

```bash
bun run migrate:deploy --help
```

Expected: Prisma CLI help output for `migrate deploy`.

**Step 4: Commit**

```bash
git add package.json CLAUDE.md
git commit -m "chore: add migrate:deploy script for production deployments"
```

---

### Task 3: Replace axios with API client in Form.tsx

**Context:** `useMessageSubmitHandlers` is an inline hook at lines 496–627 of `Form.tsx`. It has 3 axios calls:

- Line 544: `axios.post("/api/ai/chat", ...)` — non-streaming AI fallback
- Line 566: `axios.post("/api/messages", ...)` — regular message send
- Line 605: `axios.post("/api/messages", ...)` — image upload callback (fire-and-forget `.catch()` style)

**Files:**

- Modify: `app/(dashboard)/dashboard/conversations/[conversationId]/components/Form.tsx`

**Step 1: Add the api import**

At the top of the file, after the existing imports, add:

```typescript
import { api } from "@/app/lib/api-client"
```

**Step 2: Replace the AI chat axios call (line 544)**

Replace:

```typescript
await axios.post(
  "/api/ai/chat",
  {
    message: trimmedMessage || undefined,
    image: queuedImage || undefined,
    conversationId: conversationId,
  },
  { headers }
)
```

With:

```typescript
await api.post(
  "/api/ai/chat",
  {
    message: trimmedMessage || undefined,
    image: queuedImage || undefined,
    conversationId: conversationId,
  },
  { retries: 0, showErrorToast: false }
)
```

Note: CSRF headers are handled automatically by the API client via the `X-CSRF-Token` cookie; you do not need to pass `headers` manually. The `api.post` helper reads the CSRF cookie internally.

Wait — check `app/lib/api-client.ts` to confirm how CSRF is passed before making this change. If the client does NOT auto-attach CSRF, pass it explicitly:

```typescript
await api.post("/api/ai/chat", { ... }, {
  retries: 0,
  showErrorToast: false,
  headers: { "X-CSRF-Token": csrfToken ?? "" },
})
```

**Step 3: Replace the regular message axios call (line 566)**

Replace:

```typescript
await axios.post(
  "/api/messages",
  { message: trimmedMessage, conversationId: conversationId },
  { headers }
)
```

With (same CSRF caveat as Step 2):

```typescript
await api.post(
  "/api/messages",
  { message: trimmedMessage, conversationId: conversationId },
  { retries: 1, showErrorToast: false }
)
```

**Step 4: Replace the image upload axios call (line 605)**

Replace:

```typescript
axios
  .post(
    "/api/messages",
    {
      image: result.info.secure_url,
      conversationId: conversationId,
    },
    {
      headers: { "X-CSRF-Token": csrfToken },
    }
  )
  .catch((error) => {
    console.error("Image upload error:", error)
    toast.error("Failed to upload image")
  })
```

With:

```typescript
api
  .post(
    "/api/messages",
    {
      image: result.info.secure_url,
      conversationId: conversationId,
    },
    { retries: 0, showErrorToast: false }
  )
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Failed to upload image"
    toast.error(message)
  })
```

**Step 5: Remove the axios import (line 14)**

Delete:

```typescript
import axios from "axios"
```

**Step 6: Type-check**

```bash
bun run typecheck 2>&1 | grep -i "Form\|axios" | head -20
```

Expected: no errors referencing Form.tsx or axios.

**Step 7: Commit**

```bash
git add "app/(dashboard)/dashboard/conversations/[conversationId]/components/Form.tsx"
git commit -m "refactor(form): replace axios with centralized api-client"
```

---

## Phase 2 — Component Refactors

### Task 4: Extract Form.tsx private components to separate files

**Context:** `Form.tsx` has five self-contained units defined inline:

- `PendingImagePreview` (lines 64–92, 28 lines)
- `ImageGenerationDialog` (lines 94–174, 80 lines)
- `ComposerRow` + its props interface (lines 176–336, 160 lines)
- `FormPanel` + its props interface (lines 338–480, 142 lines)
- `useMessageSubmitHandlers` + its params interface (lines 482–627, 145 lines)

Extracting these to their own files drops `Form.tsx` from 890 lines to ~300.

**Files to create:**

- `app/(dashboard)/dashboard/conversations/[conversationId]/components/PendingImagePreview.tsx`
- `app/(dashboard)/dashboard/conversations/[conversationId]/components/ImageGenerationDialog.tsx`
- `app/(dashboard)/dashboard/conversations/[conversationId]/components/ComposerRow.tsx`
- `app/(dashboard)/dashboard/conversations/[conversationId]/components/FormPanel.tsx`
- `app/(dashboard)/dashboard/conversations/[conversationId]/components/useMessageSubmit.ts`

**Files to modify:**

- `app/(dashboard)/dashboard/conversations/[conversationId]/components/Form.tsx`

**Step 1: Create PendingImagePreview.tsx**

Cut lines 64–92 from `Form.tsx` and write them to the new file. Add the necessary imports at the top:

```typescript
import Image from "next/image"
import { HiXMark } from "react-icons/hi2"

interface PendingImagePreviewProps {
  pendingImage: string
  onRemove: () => void
}

export function PendingImagePreview({ pendingImage, onRemove }: PendingImagePreviewProps) {
  // ... paste the JSX body here
}
```

**Step 2: Create ImageGenerationDialog.tsx**

Cut lines 94–174 from `Form.tsx` (the interface + component) and write to new file. Add imports:

```typescript
import { Button } from "@/app/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"

type ImageSize = "512x512" | "1024x1024" | "1024x1792" | "1792x1024"

// ... paste ImageGenerationDialogProps interface and component
export { ImageSize }
```

**Step 3: Create ComposerRow.tsx**

Cut lines 176–336 from `Form.tsx`. Add imports (Button, MessageInput, VoiceInput, CldUploadButton, icons, etc.) as needed. Export the component.

**Step 4: Create FormPanel.tsx**

Cut lines 338–480 from `Form.tsx`. Import `PendingImagePreview`, `ComposerRow`, `ImageGenerationDialog`, and `SuggestionChips`. Export the component.

**Step 5: Create useMessageSubmit.ts**

Cut lines 482–627 from `Form.tsx`. This is `useMessageSubmitHandlers` — rename to `useMessageSubmit` for clarity. Add imports for `api` (from api-client), `toast`, `useCallback`, and the Cloudinary type.

```typescript
// useMessageSubmit.ts
"use client"

import { useCallback } from "react"
import type { CloudinaryUploadWidgetResults } from "next-cloudinary"
import { useForm, type FieldValues, type SubmitHandler } from "react-hook-form"
import toast from "react-hot-toast"

import { api } from "@/app/lib/api-client"

// ... paste UseMessageSubmitHandlersParams interface (rename to UseMessageSubmitParams)
// ... paste the hook body, renamed to useMessageSubmit
export { useMessageSubmit }
```

**Step 6: Update Form.tsx imports**

Replace the removed code in `Form.tsx` with imports from the new files:

```typescript
import { ComposerRow } from "./ComposerRow"
import { FormPanel } from "./FormPanel"
import { ImageGenerationDialog } from "./ImageGenerationDialog"
import { PendingImagePreview } from "./PendingImagePreview"
import { useMessageSubmit } from "./useMessageSubmit"
```

Also update the call site in `Form` component from `useMessageSubmitHandlers` → `useMessageSubmit`.

**Step 7: Type-check and verify**

```bash
bun run typecheck 2>&1 | head -40
```

Expected: no type errors.

**Step 8: Verify file sizes**

```bash
wc -l "app/(dashboard)/dashboard/conversations/[conversationId]/components/"*.tsx \
       "app/(dashboard)/dashboard/conversations/[conversationId]/components/"*.ts
```

Expected: `Form.tsx` under 350 lines, all extracted files under 200 lines each.

**Step 9: Commit**

```bash
git add "app/(dashboard)/dashboard/conversations/[conversationId]/components/"
git commit -m "refactor(form): extract sub-components and hook to separate files"
```

---

### Task 5: Slim down profile/page.tsx

**Context:** `profile/page.tsx` is 687 lines. The tab components already exist in `profile/components/`. The page holds state and fetch logic that should live closer to the components that use it.

**Files:**

- Modify: `app/(dashboard)/dashboard/profile/page.tsx`
- Modify relevant tab components in `app/(dashboard)/dashboard/profile/components/`

**Step 1: Read the full profile page**

Read `app/(dashboard)/dashboard/profile/page.tsx` in full to identify which state/logic blocks belong in which tab component.

**Step 2: Move state + fetch logic per tab**

For each tab (Profile, Password, Notifications, Account, Safety), identify state variables and fetch calls that only that tab uses, and move them into the corresponding tab component. The page should only keep:

- Top-level tab selection state
- Shared data needed across multiple tabs (e.g. user identity)

**Step 3: Type-check**

```bash
bun run typecheck 2>&1 | grep -i "profile" | head -20
```

**Step 4: Verify file sizes**

```bash
wc -l "app/(dashboard)/dashboard/profile/page.tsx" \
       "app/(dashboard)/dashboard/profile/components/"*.tsx
```

Expected: `page.tsx` under 200 lines.

**Step 5: Commit**

```bash
git add "app/(dashboard)/dashboard/profile/"
git commit -m "refactor(profile): move tab state/fetch logic into tab components"
```

---

## Phase 3 — NSFW Age Gate

### Task 6: Replace NsfwGateCard with proper age gate modal

**Context:** `NsfwGateCard.tsx` (at `app/components/safety/NsfwGateCard.tsx`) currently shows a single button that sets `isAdult: true, nsfwEnabled: true` in one shot with no confirmation. The API at `PATCH /api/safety/preferences` already enforces that `isAdult` must be true before `nsfwEnabled` can be set. The schema already has `adultConfirmedAt` and `nsfwEnabledAt` fields. What's missing is a proper consent UI.

**Files:**

- Modify: `app/components/safety/NsfwGateCard.tsx`

**Step 1: Write the failing test (for the gate logic)**

Create `app/__tests__/components/NsfwGateCard.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { NsfwGateCard } from "@/app/components/safety/NsfwGateCard"

// Mock the api client
jest.mock("@/app/lib/api-client", () => ({
  api: { patch: jest.fn() },
  ApiError: class ApiError extends Error {},
  createLoadingToast: () => ({ success: jest.fn(), error: jest.fn() }),
}))

jest.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isSignedIn: true }),
}))

describe("NsfwGateCard", () => {
  it("shows confirmation dialog when button is clicked", () => {
    render(<NsfwGateCard />)
    fireEvent.click(screen.getByRole("button", { name: /enable.*nsfw/i }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("does not call API until user confirms in dialog", () => {
    const { api } = require("@/app/lib/api-client")
    render(<NsfwGateCard />)
    fireEvent.click(screen.getByRole("button", { name: /enable.*nsfw/i }))
    // Dialog is open but API not called yet
    expect(api.patch).not.toHaveBeenCalled()
  })

  it("requires age checkbox to be checked before confirm is enabled", () => {
    render(<NsfwGateCard />)
    fireEvent.click(screen.getByRole("button", { name: /enable.*nsfw/i }))
    const confirmButton = screen.getByRole("button", { name: /confirm/i })
    expect(confirmButton).toBeDisabled()
  })

  it("calls API after user checks age box and confirms", async () => {
    const { api } = require("@/app/lib/api-client")
    api.patch.mockResolvedValueOnce({})
    render(<NsfwGateCard />)
    fireEvent.click(screen.getByRole("button", { name: /enable.*nsfw/i }))
    fireEvent.click(screen.getByRole("checkbox", { name: /18/i }))
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }))
    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(
        "/api/safety/preferences",
        { isAdult: true, nsfwEnabled: true },
        expect.any(Object)
      )
    })
  })
})
```

**Step 2: Run the test to confirm it fails**

```bash
bun test app/__tests__/components/NsfwGateCard.test.tsx 2>&1 | tail -20
```

Expected: FAIL — tests reference dialog and checkbox that don't exist yet.

**Step 3: Rewrite NsfwGateCard.tsx**

Replace the entire file with:

```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"

import { api, ApiError, createLoadingToast } from "@/app/lib/api-client"
import { Button } from "@/app/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"

export function NsfwGateCard() {
  const router = useRouter()
  const { isSignedIn } = useAuth()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleOpenGate = () => {
    if (!isSignedIn) {
      router.push("/sign-in")
      return
    }
    setDialogOpen(true)
  }

  const handleConfirm = async () => {
    if (!ageConfirmed) return

    setIsLoading(true)
    const loader = createLoadingToast("Enabling NSFW content...")

    try {
      await api.patch(
        "/api/safety/preferences",
        { isAdult: true, nsfwEnabled: true },
        { retries: 0, showErrorToast: false }
      )
      loader.success("NSFW content enabled")
      setDialogOpen(false)
      router.refresh()
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to enable NSFW content"
      loader.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setDialogOpen(false)
    setAgeConfirmed(false)
  }

  return (
    <>
      <Button onClick={handleOpenGate} aria-haspopup="dialog">
        Enable 18+ NSFW
      </Button>

      <Dialog open={dialogOpen} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Age Verification Required</DialogTitle>
            <DialogDescription>
              This content is intended for adults only. By proceeding, you confirm that you are 18
              years of age or older and agree to our{" "}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                Content Policy
              </a>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-3 py-2">
            <input
              type="checkbox"
              id="age-confirm"
              checked={ageConfirmed}
              onChange={(e) => setAgeConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border"
              aria-label="I confirm I am 18 years of age or older"
            />
            <label htmlFor="age-confirm" className="cursor-pointer text-sm text-foreground">
              I confirm that I am <strong>18 years of age or older</strong> and understand that
              this content may include adult themes.
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!ageConfirmed || isLoading}
              aria-busy={isLoading}
            >
              {isLoading ? "Enabling..." : "Confirm & Enable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

**Step 4: Run the tests**

```bash
bun test app/__tests__/components/NsfwGateCard.test.tsx 2>&1 | tail -20
```

Expected: all 4 tests PASS.

**Step 5: Type-check**

```bash
bun run typecheck 2>&1 | grep -i "nsfw\|gate\|safety" | head -10
```

Expected: no errors.

**Step 6: Commit**

```bash
git add app/components/safety/NsfwGateCard.tsx app/__tests__/components/NsfwGateCard.test.tsx
git commit -m "feat(nsfw): replace single-click enable with age gate confirmation modal"
```

---

### Task 7: Harden canAccessNsfw() to check adultConfirmedAt

**Context:** `canAccessNsfw()` in `app/lib/nsfw.ts` currently checks `isAdult && nsfwEnabled`. The schema has `adultConfirmedAt` which records _when_ consent was given. Adding this check prevents anyone who slipped through with `isAdult: true` but no timestamp from accessing NSFW content.

**Files:**

- Modify: `app/lib/nsfw.ts`
- Modify: `app/__tests__/lib/` (add nsfw test or extend existing)

**Step 1: Write the failing test**

Create `app/__tests__/lib/nsfw.test.ts`:

```typescript
import { canAccessNsfw } from "@/app/lib/nsfw"

describe("canAccessNsfw", () => {
  it("returns false when user is null", () => {
    expect(canAccessNsfw(null)).toBe(false)
  })

  it("returns false when isAdult is false", () => {
    expect(canAccessNsfw({ isAdult: false, nsfwEnabled: true, adultConfirmedAt: new Date() })).toBe(
      false
    )
  })

  it("returns false when nsfwEnabled is false", () => {
    expect(canAccessNsfw({ isAdult: true, nsfwEnabled: false, adultConfirmedAt: new Date() })).toBe(
      false
    )
  })

  it("returns false when adultConfirmedAt is null (no consent timestamp)", () => {
    expect(canAccessNsfw({ isAdult: true, nsfwEnabled: true, adultConfirmedAt: null })).toBe(false)
  })

  it("returns true when all three conditions are met", () => {
    expect(canAccessNsfw({ isAdult: true, nsfwEnabled: true, adultConfirmedAt: new Date() })).toBe(
      true
    )
  })
})
```

**Step 2: Run to confirm it fails**

```bash
bun test app/__tests__/lib/nsfw.test.ts 2>&1 | tail -20
```

Expected: the `adultConfirmedAt: null` test case FAILS (current code ignores it).

**Step 3: Update canAccessNsfw()**

Replace `app/lib/nsfw.ts` with:

```typescript
export function canAccessNsfw(
  user:
    | {
        isAdult?: boolean | null
        nsfwEnabled?: boolean | null
        adultConfirmedAt?: Date | null
      }
    | null
    | undefined
): boolean {
  return Boolean(user?.isAdult && user?.nsfwEnabled && user?.adultConfirmedAt)
}
```

**Step 4: Check all callers for the new signature**

```bash
grep -rn "canAccessNsfw" --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v ".next"
```

For each caller, verify the object passed includes `adultConfirmedAt` in its Prisma `select` clause. If it doesn't, add it.

**Step 5: Run all tests**

```bash
bun test 2>&1 | tail -30
```

Expected: all tests pass including the new nsfw.test.ts.

**Step 6: Type-check**

```bash
bun run typecheck 2>&1 | head -30
```

Expected: no errors.

**Step 7: Commit**

```bash
git add app/lib/nsfw.ts app/__tests__/lib/nsfw.test.ts
git commit -m "feat(nsfw): require adultConfirmedAt timestamp in canAccessNsfw check"
```

---

## Verification Checklist

After all tasks complete, run this final check:

```bash
# No axios import in Form.tsx
grep "import axios" "app/(dashboard)/dashboard/conversations/[conversationId]/components/Form.tsx"
# Expected: no output

# No personal domain in CSP
grep "lscaturchio" next.config.mjs
# Expected: no output

# migrate:deploy script exists
grep "migrate:deploy" package.json
# Expected: "migrate:deploy": "prisma migrate deploy"

# Form.tsx under 350 lines
wc -l "app/(dashboard)/dashboard/conversations/[conversationId]/components/Form.tsx"
# Expected: < 350

# All tests pass
bun test 2>&1 | tail -5
# Expected: X passed, 0 failed

# Type check clean
bun run typecheck 2>&1 | grep -c "error TS"
# Expected: 0
```
