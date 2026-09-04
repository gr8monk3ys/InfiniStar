# Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the nine-axis gap between InfiniStar's code quality (good) and its operational readiness (not), taking every axis to an A.

**Architecture:** Three invariants currently live only in prose — the `guard()` route contract, the coverage floor, and the docs' own references. Each gets a check that fails CI, landed _before_ the bulk work it governs, so nothing can regress while the work is in flight. The remaining work is a Redis client substitution behind an existing interface, two new CI jobs, and route migrations.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma + Neon Postgres, Clerk, Stripe, Pusher, Jest + Playwright, Bun 1.3.8, `@gr8monk3ys/next-kit` rate limiting.

**Spec:** `docs/superpowers/specs/2026-09-03-production-readiness-design.md`

## Global Constraints

- Package manager is **Bun 1.3.8**. Run tests with `bun run test`, never `bun test` (the latter lacks `jest.resetModules`/jsdom and produces false failures).
- Every command needs the CI env loaded first: `set -a; source .env.ci.example; set +a`.
- Zod v4 rejects non-RFC-4122 UUIDs. Test ids must carry a valid version and variant, e.g. `11111111-1111-4111-8111-111111111111`.
- Import Prisma as `import prisma from "@/app/lib/prismadb"` (default export). Never `import { db }` — test mocks omit it.
- Mocks of `@/app/lib/logger` MUST include `__esModule: true`, `default: { child: jest.fn() }`, and every named logger (`apiLogger`, `authLogger`, `dbLogger`) with `warn`/`info`/`error`. A missing `warn` cascades TypeErrors into unrelated suites.
- Branch from `origin/master` for every PR. Never push to `master` directly. Never open a draft PR. Never run `gh pr merge --auto`.
- Commit messages end with the two attribution lines used in this repo (see any recent commit).
- Canonical domain is `infini-star.vercel.app`. `infinistar.app` is NXDOMAIN and must not appear in new code.
- The current CI job is named `CI` and is the only required check on `master`.

---

## Baseline (measured 2026-09-03, before any task)

Re-run these before starting; every task's "expected" assumes them.

| Command                                             | Result                            |
| --------------------------------------------------- | --------------------------------- |
| `bun run lint`                                      | exit 0                            |
| `bun run typecheck`                                 | clean                             |
| `bun run test --runInBand`                          | 1180 pass / 0 fail, 108 suites    |
| `SKIP_ENV_VALIDATION=1 bun run build`               | exit 0                            |
| `bun run test:coverage`                             | 29.16% statements                 |
| `curl -s https://infini-star.vercel.app/api/health` | HTTP 503, `redis: "disconnected"` |

---

## PR 1 — CI gating

Adds the two jobs that already have tests waiting for them, plus a coverage floor pinned at today's number.

### Task 1: Run the integration and e2e suites locally to learn what CI needs

Neither suite has ever run in CI. Find out what they actually require before writing the workflow — a workflow written against an assumption will fail in the loop where feedback is slowest.

**Files:**

- No changes. This is a measurement task.

**Interfaces:**

- Produces: the exact commands, services and env vars that Tasks 2 and 3 encode.

- [ ] **Step 1: Start a disposable Postgres and apply migrations**

```bash
docker run -d --name infinistar-it -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=infinistar_test -p 55432:5432 postgres:16
sleep 5
export DATABASE_URL="postgresql://postgres:postgres@localhost:55432/infinistar_test"
export DIRECT_URL="$DATABASE_URL"
bunx prisma migrate deploy
```

Expected: `21 migrations found`, all applied.

- [ ] **Step 2: Run the integration suite**

```bash
set -a; source .env.ci.example; set +a
export DATABASE_URL="postgresql://postgres:postgres@localhost:55432/infinistar_test"
export DIRECT_URL="$DATABASE_URL"
bun run test:integration
```

Expected: the 2 suites in `app/__tests__/integration/` pass. Record the exact
failure text if they do not — the fix belongs in this task, not in CI.

- [ ] **Step 3: Run the e2e suite**

```bash
bunx playwright install --with-deps chromium
set -a; source .env.ci.example; set +a
bun run test:e2e
```

Expected: Playwright builds the app, starts it on port 3101, and runs 35
collected tests. Record which specs fail and why. `payments-live-probe.spec.ts` is
expected to self-skip (it calls `test.skip` without live credentials).

- [ ] **Step 4: Record findings in the plan**

Append a `### Findings` block under this task listing: exact pass/fail counts,
any spec that needs `test.skip` in CI, and the env vars that turned out to be
required. Tasks 2 and 3 consume this.

### Findings (recorded 2026-09-03)

**Integration** — works as-is. `postgres:16`, `prisma migrate deploy` applies
all 21 migrations, then 2 suites / **14 tests pass in 2.0s**. No code changes
needed; the job simply had to exist.

**e2e** — the suite collects **35 tests, not 128**. The 128 figure came from
counting `test(` declarations; most sit inside `describe` blocks that skip
themselves without `E2E_ASSERT_AUTH_REDIRECTS` or live credentials. One test
self-skips (`payments-live-probe`).

Of those 35, **6 failed, all stale tests rather than app defects**:

| Test                                        | Cause                                                                                                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.spec.ts:14`                           | `locator("main, body")` matches both, and Playwright strict mode rejects a locator resolving to two elements. The app grew a `#main-content` skip-link landmark. |
| `payments.spec.ts:97`, `pricing.spec.ts:13` | Assert the signed-out "Upgrade to PRO" CTA points at `/sign-in`. It points at `/sign-up`, which is correct — a visitor with no account belongs in registration.  |
| `payments.spec.ts:106`                      | Looks for "Get Started Free". The CTA reads "Create Free Account".                                                                                               |
| `pricing.spec.ts:4`, `pricing.spec.ts:30`   | Assert the h1 reads "Simple, transparent pricing". The PR #50 rebrand replaced it with "For curious chatters and serious creators".                              |

All six were corrected against the app's verified behavior — probed with
`curl` against a locally built server — rather than the reverse. Result:
**34 passed, 1 skipped, 0 failed**.

**One config change was required.** The webServer budget was 180s, but its
command builds before it starts: ~150s locally, and a GitHub runner is slower.
An expired budget surfaces as `ERR_CONNECTION_REFUSED` on every test rather
than as a timeout, which is exactly how the first local run presented. Raised
to 300s.

- [ ] **Step 5: Tear down**

```bash
docker rm -f infinistar-it
```

- [ ] **Step 6: Commit the findings**

```bash
git add docs/superpowers/plans/2026-09-03-production-readiness.md
git commit -m "docs(plan): record what the integration and e2e suites need to run"
```

### Task 2: Add the integration job to CI

**Files:**

- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Consumes: the service config and env vars recorded in Task 1.
- Produces: a CI job named `integration`, referenced by Task 5's branch protection.

- [ ] **Step 1: Add the job**

Append to `.github/workflows/ci.yml` under `jobs:`, as a sibling of `ci`:

```yaml
integration:
  name: integration
  runs-on: ubuntu-latest
  timeout-minutes: 15
  services:
    postgres:
      image: postgres:16
      env:
        POSTGRES_PASSWORD: postgres
        POSTGRES_DB: infinistar_test
      ports:
        - 5432:5432
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/infinistar_test
    DIRECT_URL: postgresql://postgres:postgres@localhost:5432/infinistar_test
  steps:
    - uses: actions/checkout@v6
    - uses: oven-sh/setup-bun@v2
      with:
        bun-version: "1.3.8"
    - name: Load CI environment
      run: |
        while IFS='=' read -r key value; do
          [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
          key=$(echo "$key" | xargs)
          value=$(echo "$value" | xargs)
          [ -n "$key" ] && echo "$key=$value" >> "$GITHUB_ENV"
        done < .env.ci.example
    - run: bun install --frozen-lockfile
    # DATABASE_URL from the job env, not .env.ci.example, must win.
    - run: |
        echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/infinistar_test" >> "$GITHUB_ENV"
        echo "DIRECT_URL=postgresql://postgres:postgres@localhost:5432/infinistar_test" >> "$GITHUB_ENV"
    - run: bunx prisma migrate deploy
    - run: bun run test:integration
```

The re-export of `DATABASE_URL` after the `.env.ci.example` loop is load-bearing:
that loop writes a dummy `DATABASE_URL` into `GITHUB_ENV`, and the last write
wins.

- [ ] **Step 2: Validate the workflow parses**

```bash
bunx --yes @action-validator/cli@latest .github/workflows/ci.yml || \
  python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('yaml ok')"
```

Expected: `yaml ok` (or the validator's success output).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run the integration suite against a real Postgres"
```

### Task 3: Add the e2e job to CI

**Files:**

- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Consumes: Task 1's findings.
- Produces: a CI job named `e2e`, referenced by Task 5.

- [ ] **Step 1: Add the job**

Append as another sibling under `jobs:`:

```yaml
e2e:
  name: e2e
  runs-on: ubuntu-latest
  timeout-minutes: 25
  steps:
    - uses: actions/checkout@v6
    - uses: oven-sh/setup-bun@v2
      with:
        bun-version: "1.3.8"
    - name: Load CI environment
      run: |
        while IFS='=' read -r key value; do
          [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
          key=$(echo "$key" | xargs)
          value=$(echo "$value" | xargs)
          [ -n "$key" ] && echo "$key=$value" >> "$GITHUB_ENV"
        done < .env.ci.example
    - run: bun install --frozen-lockfile
    - run: bunx playwright install --with-deps chromium
    - run: bun run test:e2e
      env:
        CI: true
    - uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 7
```

- [ ] **Step 2: Validate and commit**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('yaml ok')"
git add .github/workflows/ci.yml
git commit -m "ci: run the Playwright suite, upload the report on failure"
```

### Task 4: Pin coverage at today's floor

The threshold lands at the _measured_ number so it cannot regress. PR 8 raises it.

**Files:**

- Modify: `jest.config.js`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Produces: `coverageThreshold` in the Jest config, raised by PR 8 Task 21.

- [ ] **Step 1: Measure the current floor exactly**

```bash
set -a; source .env.ci.example; set +a
bun run test:coverage --runInBand 2>&1 | grep -A3 "^All files"
```

Record the four numbers. As of 2026-09-03 they were 29.16 / 23.83 / 21.65 / 29.84
(statements / branches / functions / lines).

- [ ] **Step 2: Add the threshold, two points below measured**

Two points of slack absorbs ordering nondeterminism without letting real
regressions through. Add to `customJestConfig` in `jest.config.js`, after
`collectCoverageFrom`:

```js
  // Pinned at the 2026-09-03 measured floor minus 2 points of slack, so
  // coverage cannot regress while it is being raised. Raised deliberately,
  // never lowered to make a build pass.
  coverageThreshold: {
    global: {
      statements: 27,
      branches: 21,
      functions: 19,
      lines: 27,
    },
  },
```

- [ ] **Step 3: Verify the threshold passes**

```bash
set -a; source .env.ci.example; set +a
bun run test:coverage --runInBand 2>&1 | tail -5
```

Expected: exit 0, no "coverage threshold not met" line.

- [ ] **Step 4: Verify the threshold actually bites**

Temporarily set `statements: 95`, re-run, confirm it fails, then set it back to 27.

Expected on the temporary value: `Jest: "global" coverage threshold for statements (95%) not met`.

- [ ] **Step 5: Run coverage in CI**

In `.github/workflows/ci.yml`, replace the unit test line in the `ci` job:

```yaml
- run: bun run test --runInBand --forceExit
```

with:

```yaml
- run: bun run test:coverage --runInBand --forceExit
```

- [ ] **Step 6: Commit**

```bash
git add jest.config.js .github/workflows/ci.yml
git commit -m "ci: pin coverage at the measured floor so it cannot regress"
```

### Task 5: Open PR 1 and make the new jobs required

**Files:**

- No source changes.

- [ ] **Step 1: Push and open the PR**

```bash
git push -u origin ci/gate-integration-and-e2e
gh pr create --title "ci: run integration and e2e, pin the coverage floor" --body "$(cat <<'EOF'
35 collected Playwright tests across 13 specs and 2 integration suites exist
in this repo and have never run in CI. Both configs already name a CI job that was
never written. The money path and the auth path were covered only by tests
nobody ran.

The constraint that justified this is gone: CLAUDE.md says the repo is
private with capped Actions minutes, but it is public, so minutes are
unlimited.

Adds an `integration` job (Postgres service container) and an `e2e` job
(Playwright, report uploaded on failure), and pins `coverageThreshold` at
the measured floor so coverage cannot regress while it is raised.

Spec: docs/superpowers/specs/2026-09-03-production-readiness-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01MNwKYYjXdygHVZo7eW9jHS
EOF
)"
```

- [ ] **Step 2: Wait for all three jobs to go green**

```bash
gh pr checks --watch
```

Expected: `CI`, `integration`, `e2e` all pass. Do **not** proceed to Step 3 while
any is red — a required check that never passes blocks every future merge.

- [ ] **Step 3: Add the new jobs to branch protection, after the PR merges**

```bash
gh api -X PUT repos/gr8monk3ys/InfiniStar/branches/master/protection/required_status_checks \
  -f strict=false \
  -f 'contexts[]=CI' -f 'contexts[]=integration' -f 'contexts[]=e2e'
gh api repos/gr8monk3ys/InfiniStar/branches/master/protection --jq '.required_status_checks.contexts'
```

Expected: `["CI","integration","e2e"]`.

Required checks must be sampled from a **PR head commit**, never the default
branch — a name that only fires on `push` blocks every merge permanently. Both
new jobs run on `pull_request` because the workflow's `on:` block already
covers it.

---

## PR 2 — Upstash substitution and explicit `sslmode`

### Task 6: Replace the ioredis client with the Upstash REST client

`@gr8monk3ys/next-kit`'s `RedisLike` interface is documented as _"Satisfied as-is
by `ioredis` and by `@upstash/redis`'s REST client — both expose `incr`,
`pexpire`, `pttl` and `del` with these signatures."_ So `RedisStore` needs no
change; only the client construction and `two-factor-tokens.ts` do.

**Files:**

- Modify: `app/lib/redis.ts`
- Modify: `app/lib/two-factor-tokens.ts`
- Modify: `env.mjs`
- Modify: `.env.local.example`, `.env.template`
- Test: `app/__tests__/lib/redis.test.ts` (create)

**Interfaces:**

- Consumes: nothing.
- Produces: `getRedisClient(): Redis | null` (Upstash `Redis`, which structurally satisfies next-kit's `RedisLike`) and `isRedisAvailable(): Promise<boolean>` — same names and shapes as today, so `rate-limit.ts` and `health/route.ts` are untouched.

- [ ] **Step 1: Write the failing test**

Create `app/__tests__/lib/redis.test.ts`:

```ts
/**
 * The client is constructed from env at first call and memoised, so each case
 * resets the module registry and the env it reads.
 */
describe("getRedisClient", () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("returns null when Upstash is not configured", async () => {
    const { getRedisClient } = await import("@/app/lib/redis")
    expect(getRedisClient()).toBeNull()
  })

  it("returns a client exposing the RedisLike surface when configured", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io"
    process.env.UPSTASH_REDIS_REST_TOKEN = "token"
    const { getRedisClient } = await import("@/app/lib/redis")
    const client = getRedisClient()
    expect(client).not.toBeNull()
    for (const method of ["incr", "pexpire", "pttl", "del", "get", "set", "ping"]) {
      expect(typeof (client as Record<string, unknown>)[method]).toBe("function")
    }
  })

  it("memoises the client across calls", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io"
    process.env.UPSTASH_REDIS_REST_TOKEN = "token"
    const { getRedisClient } = await import("@/app/lib/redis")
    expect(getRedisClient()).toBe(getRedisClient())
  })

  it("reports unavailable when Upstash is not configured", async () => {
    const { isRedisAvailable } = await import("@/app/lib/redis")
    await expect(isRedisAvailable()).resolves.toBe(false)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
set -a; source .env.ci.example; set +a
bun run test app/__tests__/lib/redis.test.ts
```

Expected: FAIL — the configured case still reads `REDIS_URL` and returns null.

- [ ] **Step 3: Install the client and drop ioredis**

```bash
bun add @upstash/redis
bun remove ioredis
```

- [ ] **Step 4: Rewrite `app/lib/redis.ts`**

```ts
import { Redis } from "@upstash/redis"

import { dbLogger } from "@/app/lib/logger"

/**
 * Redis client singleton.
 *
 * Upstash's REST client, not ioredis: a serverless function that opens a raw
 * TCP connection at module load leaks connections across invocations and
 * cannot survive the platform freezing the instance between them. The REST
 * client holds no socket, so there is nothing to leak.
 *
 * `@gr8monk3ys/next-kit`'s `RedisLike` is satisfied by this client as-is, so
 * `rate-limit.ts` needs no change.
 *
 * Returns null when Upstash is not configured; callers fall back to in-memory
 * storage, which is correct for local development and NOT correct in
 * production — `/api/health` reports degraded when it happens there.
 */
let redisClient: Redis | null = null
let connectionAttempted = false

export function getRedisClient(): Redis | null {
  if (connectionAttempted) {
    return redisClient
  }

  connectionAttempted = true

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    dbLogger.warn(
      "Upstash is not configured. Falling back to in-memory storage. " +
        "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for " +
        "distributed rate limiting and 2FA token storage."
    )
    return null
  }

  try {
    redisClient = new Redis({ url, token })
    return redisClient
  } catch (error) {
    dbLogger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      "Failed to create the Upstash client. Falling back to in-memory storage."
    )
    redisClient = null
    return null
  }
}

/** Whether Redis is configured and responding. Drives `/api/health`. */
export async function isRedisAvailable(): Promise<boolean> {
  const client = getRedisClient()
  if (!client) {
    return false
  }

  try {
    const result = await client.ping()
    return typeof result === "string" && result.toUpperCase() === "PONG"
  } catch {
    return false
  }
}
```

- [ ] **Step 5: Update `two-factor-tokens.ts` for the REST client's `set` signature**

ioredis takes variadic `("EX", seconds)`; the Upstash client takes an options
object. In `app/lib/two-factor-tokens.ts:59`, replace:

```ts
await redis.set(key, JSON.stringify({ token }), "EX", TWO_FACTOR_TOKEN_TTL_SECONDS)
```

with:

```ts
await redis.set(key, JSON.stringify({ token }), { ex: TWO_FACTOR_TOKEN_TTL_SECONDS })
```

`get` and `del` are unchanged. One caveat to handle at the `get` call site
(`app/lib/two-factor-tokens.ts:85`): the Upstash client JSON-deserialises
values automatically, so `raw` may already be an object rather than a string.
Make the parse tolerant:

```ts
const raw = await redis.get(key)
if (!raw) return null
const parsed = typeof raw === "string" ? JSON.parse(raw) : (raw as { token: string })
return parsed.token ?? null
```

- [ ] **Step 6: Swap the env schema**

In `env.mjs`, replace the `REDIS_URL` entries (lines 35 and 85) with:

```js
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
```

and in the runtime map:

```js
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
```

- [ ] **Step 7: Update `health/route.ts` to read the new vars**

In `app/api/health/route.ts`, replace:

```ts
const redisConfigured = Boolean(process.env.REDIS_URL)
```

with:

```ts
const redisConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
)
```

- [ ] **Step 8: Update the env documentation**

In `.env.local.example`, replace the two commented `REDIS_URL` lines (154-155) with:

```
# Upstash Redis (REST). Required in production: without it, rate limiting and
# 2FA tokens fall back to per-instance in-memory storage, which on serverless
# is not enforcement. Provision via the Vercel Upstash integration.
# UPSTASH_REDIS_REST_URL="https://your-db.upstash.io"
# UPSTASH_REDIS_REST_TOKEN="..."
```

Add the same two variable names to `.env.template`.

- [ ] **Step 9: Run the tests**

```bash
set -a; source .env.ci.example; set +a
bun run test app/__tests__/lib/redis.test.ts
```

Expected: 4 passed.

- [ ] **Step 10: Run the full suite, typecheck and build**

```bash
set -a; source .env.ci.example; set +a
bun run lint && bun run typecheck && bun run test --runInBand && \
  SKIP_ENV_VALIDATION=1 bun run build
```

Expected: all green, 1184 tests (1180 + the 4 new).

- [ ] **Step 11: Confirm ioredis is gone**

```bash
grep -rn "ioredis" app package.json bun.lock --include="*.ts" --include="*.json" | grep -v node_modules
```

Expected: no matches in `app/` or `package.json`.

- [ ] **Step 12: Commit**

```bash
git add app/lib/redis.ts app/lib/two-factor-tokens.ts app/api/health/route.ts \
  env.mjs .env.local.example .env.template package.json bun.lock \
  app/__tests__/lib/redis.test.ts
git commit -m "fix(redis): replace the serverless-hostile ioredis client with Upstash REST"
```

### Task 7: Set `sslmode` explicitly on the Postgres connection

52 of 52 production runtime log events are one `pg` deprecation warning. `pg` v9
and `pg-connection-string` v3 turn it from a warning into a behavior change:
`require` stops meaning `verify-full`.

**Files:**

- Modify: `app/lib/prismadb.ts`
- Test: `app/__tests__/lib/prismadb-sslmode.test.ts` (create)

**Interfaces:**

- Produces: `withExplicitSslMode(url: string): string`, exported for the test.

- [ ] **Step 1: Write the failing test**

Create `app/__tests__/lib/prismadb-sslmode.test.ts`:

```ts
import { withExplicitSslMode } from "@/app/lib/prismadb"

describe("withExplicitSslMode", () => {
  it("upgrades an implicit require to verify-full", () => {
    expect(withExplicitSslMode("postgresql://u:p@host/db?sslmode=require")).toBe(
      "postgresql://u:p@host/db?sslmode=verify-full"
    )
  })

  it("upgrades prefer and verify-ca the same way", () => {
    for (const mode of ["prefer", "verify-ca"]) {
      expect(withExplicitSslMode(`postgresql://u:p@host/db?sslmode=${mode}`)).toBe(
        "postgresql://u:p@host/db?sslmode=verify-full"
      )
    }
  })

  it("leaves an already-explicit verify-full alone", () => {
    const url = "postgresql://u:p@host/db?sslmode=verify-full"
    expect(withExplicitSslMode(url)).toBe(url)
  })

  it("leaves disable alone — a local database has no certificate to verify", () => {
    const url = "postgresql://u:p@localhost:5432/db?sslmode=disable"
    expect(withExplicitSslMode(url)).toBe(url)
  })

  it("adds nothing when no sslmode is present", () => {
    const url = "postgresql://u:p@host/db"
    expect(withExplicitSslMode(url)).toBe(url)
  })

  it("returns a malformed url unchanged rather than throwing", () => {
    expect(withExplicitSslMode("not a url")).toBe("not a url")
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
set -a; source .env.ci.example; set +a
bun run test app/__tests__/lib/prismadb-sslmode.test.ts
```

Expected: FAIL — `withExplicitSslMode` is not exported.

- [ ] **Step 3: Implement it**

Add to `app/lib/prismadb.ts`, above the client construction:

```ts
/**
 * Names the SSL mode `pg` currently *infers*, so a library upgrade cannot
 * change it underneath us.
 *
 * `pg-connection-string` v3 / `pg` v9 adopt libpq semantics, under which
 * `prefer`, `require` and `verify-ca` stop being aliases for `verify-full`
 * and become weaker. Today's behavior is `verify-full`; writing it down keeps
 * today's behavior after the upgrade. `disable` is left alone — a local
 * database has no certificate to verify.
 */
const IMPLICIT_VERIFY_FULL_MODES = new Set(["prefer", "require", "verify-ca"])

export function withExplicitSslMode(url: string): string {
  try {
    const parsed = new URL(url)
    const mode = parsed.searchParams.get("sslmode")
    if (mode && IMPLICIT_VERIFY_FULL_MODES.has(mode)) {
      parsed.searchParams.set("sslmode", "verify-full")
      return parsed.toString()
    }
    return url
  } catch {
    // Not a parseable URL. Prisma will produce a better error than we can.
    return url
  }
}
```

Then apply it wherever the connection string is read in that file — wrap the
`process.env.DATABASE_URL` expression in `withExplicitSslMode(...)`. Read the
surrounding lines first; the adapter construction differs between the Neon and
pg adapters and both are imported here.

- [ ] **Step 4: Run the test**

```bash
set -a; source .env.ci.example; set +a
bun run test app/__tests__/lib/prismadb-sslmode.test.ts
```

Expected: 6 passed.

- [ ] **Step 5: Prove it against a real database**

```bash
docker run -d --name infinistar-ssl -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=infinistar_test -p 55432:5432 postgres:16
sleep 5
export DATABASE_URL="postgresql://postgres:postgres@localhost:55432/infinistar_test?sslmode=disable"
export DIRECT_URL="$DATABASE_URL"
bunx prisma migrate deploy
set -a; source .env.ci.example; set +a
DATABASE_URL="$DATABASE_URL" DIRECT_URL="$DIRECT_URL" bun run test:integration
docker rm -f infinistar-ssl
```

Expected: migrations apply and the integration suites pass — the `disable`
path is untouched.

- [ ] **Step 6: Commit**

```bash
git add app/lib/prismadb.ts app/__tests__/lib/prismadb-sslmode.test.ts
git commit -m "fix(db): name the SSL mode pg infers, before pg v9 changes it"
```

### Task 8: Open PR 2 and write the owner handover

**Files:**

- Create: `docs/runbooks/upstash-provisioning.md`

- [ ] **Step 1: Write the handover runbook**

````markdown
# Provisioning Upstash

Owner-only: needs Vercel dashboard access.

Production has been serving HTTP 503 from `/api/health` because `REDIS_URL`
was set to an unreachable value. Rate limiting and 2FA token storage were
silently falling back to per-instance in-memory storage, which on serverless
is not enforcement.

1. Vercel dashboard → the `infini-star` project → **Storage** → **Upstash
   Redis** → create a database in the region closest to the deployment.
   The free tier (500K commands/month) covers current traffic by roughly
   three orders of magnitude.
2. Accept the integration's offer to add `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN` to all three environments.
3. **Delete the stale `REDIS_URL`** from every environment. Nothing reads it
   any more; leaving it is a trap for the next person.
4. Redeploy production.
5. Verify:

   ```bash
   curl -s https://infini-star.vercel.app/api/health
   ```
````

Expected: HTTP 200 and `{"status":"ok",...,"redis":"connected"}`.
Anything else means step 2 or 4 did not take.

````

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin fix/upstash-and-sslmode
gh pr create --title "fix: replace ioredis with Upstash, name the pg SSL mode" --body "$(cat <<'EOF'
Production has been returning HTTP 503 from its own health endpoint.
`redis: "disconnected"` requires REDIS_URL to be set and unreachable, so a
broken value is configured in Vercel. Per CLAUDE.md that means rate limiting
and 2FA tokens fell back to in-memory storage — per-instance on serverless,
which is not enforcement.

The client compounded it: ioredis with `lazyConnect: false` opens a raw TCP
connection at module load inside a serverless function. This swaps in
Upstash's REST client, which holds no socket. next-kit's `RedisLike` is
documented as satisfied by that client as-is, so `rate-limit.ts` is untouched
and only `two-factor-tokens.ts` needed signature changes.

Also names the SSL mode `pg` currently infers — that deprecation is 52 of 52
production log events, and pg v9 turns it into a behavior change.

Merging this does NOT clear the 503 on its own. See
docs/runbooks/upstash-provisioning.md for the owner steps.

Spec: docs/superpowers/specs/2026-09-03-production-readiness-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01MNwKYYjXdygHVZo7eW9jHS
EOF
)"
gh pr checks --watch
````

---

## PR 3 — Guard enforcement, the defective routes, and clerk-proxy

### Task 9: Make `guard()` taggable and assert the contract in a test

**Files:**

- Modify: `app/lib/guarded-route.ts`
- Create: `app/__tests__/api/route-guard-contract.test.ts`
- Create: `app/lib/guarded-route-allowlist.ts`

**Interfaces:**

- Consumes: `guard()` as it exists today.
- Produces: `isGuarded(handler: unknown): boolean` and `GUARD_ALLOWLIST: Record<string, string>` (route path → reason), consumed by Tasks 12-15.

- [ ] **Step 1: Write the failing contract test**

Create `app/__tests__/api/route-guard-contract.test.ts`:

```ts
import { readdirSync, statSync } from "fs"
import { join, relative } from "path"

import { GUARD_ALLOWLIST } from "@/app/lib/guarded-route-allowlist"

/**
 * Every route module's exported method handlers must come from `guard()`.
 *
 * `guard()` exists because there was no interface for a route to be absent
 * from, so nothing could detect an omission — which is how six state-changing
 * routes ended up with no rate limiter. This test is that interface: it is
 * the thing a route can now be absent from.
 *
 * A route may appear in GUARD_ALLOWLIST only with a reason stating why the
 * guard cannot express it.
 */
const API_ROOT = join(process.cwd(), "app", "api")
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const

function findRouteFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      found.push(...findRouteFiles(full))
    } else if (entry === "route.ts") {
      found.push(full)
    }
  }
  return found
}

const routeFiles = findRouteFiles(API_ROOT)

it("finds the route modules", () => {
  expect(routeFiles.length).toBeGreaterThan(80)
})

describe.each(routeFiles.map((f) => [relative(process.cwd(), f), f] as const))(
  "%s",
  (routeId, routeFile) => {
    it("exports only guarded handlers", async () => {
      if (routeId in GUARD_ALLOWLIST) {
        expect(GUARD_ALLOWLIST[routeId]).toEqual(expect.stringMatching(/\S{20,}/))
        return
      }

      const mod = (await import(routeFile)) as Record<string, unknown>
      const exported = METHODS.filter((m) => typeof mod[m] === "function")

      expect(exported.length).toBeGreaterThan(0)

      for (const method of exported) {
        const handler = mod[method] as { __guarded?: boolean }
        expect(handler.__guarded).toBe(true)
      }
    })
  }
)

it("has no stale allowlist entries", () => {
  const known = new Set(routeFiles.map((f) => relative(process.cwd(), f)))
  for (const entry of Object.keys(GUARD_ALLOWLIST)) {
    expect(known).toContain(entry)
  }
})
```

- [ ] **Step 2: Create the allowlist with today's real exceptions**

Create `app/lib/guarded-route-allowlist.ts`:

```ts
/**
 * Route modules exempt from the guard contract, each with the reason the
 * guard cannot express it.
 *
 * This list only shrinks. Adding an entry is a design decision, not a way to
 * make `route-guard-contract.test.ts` pass.
 */
export const GUARD_ALLOWLIST: Record<string, string> = {
  "app/api/webhooks/clerk/route.ts":
    "Svix signature verification replaces auth and CSRF, and reads the raw body before any parse.",
  "app/api/webhooks/stripe/route.ts":
    "Stripe signature verification requires the untouched raw request body, which the guard's body parsing would consume.",
  "app/api/pusher/auth/route.ts":
    "Pusher's client library posts form-encoded data without the CSRF header and cannot be made to send one.",
  "app/api/clerk-proxy/[[...path]]/route.ts":
    "A transparent pass-through proxy: it must forward every method and body untouched, including ones the guard would reject.",
}
```

- [ ] **Step 3: Run it and watch it fail**

```bash
set -a; source .env.ci.example; set +a
bun run test app/__tests__/api/route-guard-contract.test.ts 2>&1 | tail -20
```

Expected: FAIL — roughly 78 route modules report `expect(undefined).toBe(true)`,
because `guard()` does not yet tag its handlers.

- [ ] **Step 4: Tag the handler in `guard()`**

In `app/lib/guarded-route.ts`, the `guard` function currently ends with
`return async (request, context) => { ... }`. Assign it first, tag it, return it:

```ts
const guarded = async (
  request: NextRequest,
  context: RouteContext<TParams>
): Promise<NextResponse> => {
  // ... existing body, unchanged ...
}

// The marker `route-guard-contract.test.ts` asserts on. A route that spells
// the preamble by hand has no way to acquire it, which is the point.
Object.defineProperty(guarded, "__guarded", { value: true, enumerable: false })

return guarded
```

- [ ] **Step 5: Confirm the 7 already-migrated routes now pass**

```bash
set -a; source .env.ci.example; set +a
bun run test app/__tests__/api/route-guard-contract.test.ts 2>&1 | tail -20
```

Expected: still FAIL, but the failures are now exactly the un-migrated routes.
Record the count — it is the migration's burn-down number.

- [ ] **Step 6: Commit the enforcement, failing**

The test is committed red on this branch and goes green within this PR (Task 10)
and PRs 4-6. Do not add a `.skip`.

```bash
git add app/lib/guarded-route.ts app/lib/guarded-route-allowlist.ts \
  app/__tests__/api/route-guard-contract.test.ts
git commit -m "test(api): assert every route handler comes from guard()"
```

### Task 10: Migrate the four genuinely defective routes

Of the six mutating routes with no limiter, two are webhooks already allowlisted
in Task 9 (signature-verified, and Stripe/Clerk retry on 429 anyway). The
remaining four are the actual defect.

**Files:**

- Modify: `app/api/conversations/route.ts`
- Modify: `app/api/conversations/[conversationId]/route.ts`
- Modify: `app/api/auth/fallback/sign-out/route.ts`
- Modify: `app/api/notifications/push/test/route.ts`

**Interfaces:**

- Consumes: `guard` from `@/app/lib/guarded-route`, `apiLimiter` from `@/app/lib/rate-limit`.

- [ ] **Step 1: Read each route in full before touching it**

```bash
for f in app/api/conversations/route.ts \
         "app/api/conversations/[conversationId]/route.ts" \
         app/api/auth/fallback/sign-out/route.ts \
         app/api/notifications/push/test/route.ts; do
  echo "########## $f"; cat "$f"; done
```

These four are not mechanical — `conversations/route.ts` is 585 lines. Read the
whole file, then apply the pattern below to each exported handler.

- [ ] **Step 2: Apply the migration pattern**

The shape to convert _from_:

```ts
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const headerToken = request.headers.get("X-CSRF-Token")
    const cookieToken = getCsrfTokenFromRequest(request)
    if (!verifyCsrfToken(headerToken, cookieToken)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }
    const body = createThingSchema.parse(await request.json())
    // ... real work ...
  } catch (error) {
    apiLogger.error({ err: error }, "...")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

and _to_:

```ts
export const POST = guard(
  { limiter: apiLimiter, body: createThingSchema },
  async ({ user, body }) => {
    // ... real work, unchanged ...
  }
)
```

Rules while converting:

- Delete the hand-rolled 401, the CSRF block, the Zod `parse`, and the outer
  `try`/`catch` — `guard` owns all four, and a leftover catch swallows errors
  the guard would have logged with method and path.
- `currentUser` becomes `user`. `params` arrives already awaited.
- CSRF defaults to on for POST/PUT/PATCH/DELETE. Do not pass `csrf: true`.
- Every one of these four gets `limiter: apiLimiter` — that is the defect being
  fixed.
- Remove imports that become unused; `bun run lint` will name them.

- [ ] **Step 3: Run the contract test**

```bash
set -a; source .env.ci.example; set +a
bun run test app/__tests__/api/route-guard-contract.test.ts 2>&1 | tail -5
```

Expected: four fewer failures than Task 9 Step 5 recorded.

- [ ] **Step 4: Run the suites that cover these routes**

```bash
set -a; source .env.ci.example; set +a
bun run test --runInBand -t conversation
bun run test --runInBand app/__tests__/api
```

Expected: all pass. If a suite asserted on a hand-rolled error body the guard
now words differently, update the assertion to the guard's wording — the guard
is the contract now.

- [ ] **Step 5: Full gate**

```bash
set -a; source .env.ci.example; set +a
bun run lint && bun run typecheck && bun run test --runInBand
```

- [ ] **Step 6: Commit**

```bash
git add app/api/conversations app/api/auth/fallback/sign-out \
  app/api/notifications/push/test
git commit -m "fix(api): rate-limit the four mutating routes that had no limiter"
```

### Task 11: Harden clerk-proxy

**Files:**

- Modify: `app/api/clerk-proxy/[[...path]]/route.ts`
- Create: `app/__tests__/api/clerk-proxy-hardening.test.ts`

**Interfaces:**

- Produces: `getForwardedFor` and `getUpstreamUrl` behavior changes; both stay module-private, so the test drives them through the exported handlers.

- [ ] **Step 1: Write the failing test**

Create `app/__tests__/api/clerk-proxy-hardening.test.ts`:

```ts
/**
 * The proxy forwards X-Forwarded-For to Clerk, and Clerk's bot protection and
 * rate limiting key on it. Taking the client-supplied value verbatim lets a
 * caller choose its own identity for those controls.
 */
jest.mock("@/app/lib/clerk-proxy", () => ({
  getClerkFrontendApiOrigin: () => "https://clerk.example.com",
}))

const fetchMock = jest.fn()
global.fetch = fetchMock as unknown as typeof fetch

describe("clerk-proxy", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }))
    process.env.CLERK_SECRET_KEY = "sk_test_key"
  })

  it("forwards only the first hop of a client-supplied forwarded-for chain", async () => {
    const { GET } = await import("@/app/api/clerk-proxy/[[...path]]/route")
    const request = new Request("https://app.example.com/api/clerk-proxy/v1/client", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.10.11.12" },
    })

    await GET(request as never, { params: Promise.resolve({ path: ["v1", "client"] }) } as never)

    const [, init] = fetchMock.mock.calls[0]
    expect((init.headers as Headers).get("X-Forwarded-For")).toBe("1.2.3.4")
  })

  it("does not let a traversal segment escape the Clerk base path", async () => {
    const { GET } = await import("@/app/api/clerk-proxy/[[...path]]/route")
    const request = new Request("https://app.example.com/api/clerk-proxy/x")

    const response = await GET(
      request as never,
      {
        params: Promise.resolve({ path: ["..", "..", "admin"] }),
      } as never
    )

    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
set -a; source .env.ci.example; set +a
bun run test app/__tests__/api/clerk-proxy-hardening.test.ts
```

Expected: FAIL on both — the whole chain is forwarded, and the traversal is
proxied rather than rejected.

- [ ] **Step 3: Take the first hop only**

In `app/api/clerk-proxy/[[...path]]/route.ts`, replace `getForwardedFor`:

```ts
/**
 * The client-facing hop of the forwarded-for chain.
 *
 * Clerk's bot protection and rate limiting key on this header, so forwarding
 * the client's own value verbatim would let a caller pick its identity for
 * those controls. The leftmost entry is the one the platform's proxy
 * observed; everything after it is caller-supplied.
 */
function getForwardedFor(request: NextRequest) {
  const chain = request.headers.get("x-forwarded-for")
  const firstHop = chain?.split(",")[0]?.trim()
  return firstHop || "127.0.0.1"
}
```

- [ ] **Step 4: Reject anything that escapes the base path**

Replace `getUpstreamUrl` with a version that validates after normalisation:

```ts
/**
 * The upstream URL for a proxied request, or null when the resolved path
 * escapes the Clerk base path. `URL` normalises `..` segments, so the check
 * has to happen after construction, not on the raw segments.
 */
function getUpstreamUrl(request: NextRequest, path?: string[]) {
  const url = getUpstreamBaseUrl()
  const basePath = url.pathname.replace(/\/$/, "")

  if (path && path.length > 0) {
    url.pathname = `${basePath}/${path.join("/")}`
  }

  if (!url.pathname.startsWith(basePath === "" ? "/" : basePath)) {
    return null
  }

  url.search = request.nextUrl.search

  return url
}
```

Then at each call site, return a 400 when it is null:

```ts
const upstreamUrl = getUpstreamUrl(request, path)
if (!upstreamUrl) {
  return NextResponse.json({ error: "Invalid proxy path" }, { status: 400 })
}
```

- [ ] **Step 5: Run the tests**

```bash
set -a; source .env.ci.example; set +a
bun run test app/__tests__/api/clerk-proxy-hardening.test.ts \
  app/__tests__/api/clerk-proxy-route.test.ts
```

Expected: both suites pass. The pre-existing `clerk-proxy-route.test.ts` must
still pass — it asserts the secret-key header is set.

- [ ] **Step 6: Full gate and commit**

```bash
set -a; source .env.ci.example; set +a
bun run lint && bun run typecheck && bun run test --runInBand
git add "app/api/clerk-proxy/[[...path]]/route.ts" \
  app/__tests__/api/clerk-proxy-hardening.test.ts
git commit -m "fix(clerk-proxy): take the trusted forwarded-for hop, reject path escapes"
```

- [ ] **Step 7: Open PR 3**

The guard contract test is still red at this point — it goes green in PR 6.
Say so in the PR body so a reviewer does not read it as a broken build.

```bash
git push -u origin fix/guard-contract-and-defective-routes
gh pr create --title "fix(api): enforce the guard contract, fix the routes that violated it" --body "$(cat <<'EOF'
`guard()` exists because there was no interface for a route to be absent from,
so nothing could detect an omission — which is how four mutating routes ended
up with no rate limiter. This adds the missing interface: `guard()` tags the
handler it returns, and a test asserts every exported route handler carries
the tag or appears in an allowlist with a stated reason.

Also fixes the four routes that were the defect (`POST/PATCH/DELETE
/api/conversations`, the conversation detail route, fallback sign-out, and the
push test route), and hardens `clerk-proxy`, which forwarded the raw
client-controlled `x-forwarded-for` upstream to Clerk — the header Clerk's own
bot protection keys on.

The contract test is RED on this branch by design and burns down across the
three migration PRs that follow. It is committed red rather than skipped, so
the burn-down is visible.

Spec: docs/superpowers/specs/2026-09-03-production-readiness-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01MNwKYYjXdygHVZo7eW9jHS
EOF
)"
```

---

## PRs 4-6 — Guard migration batches

Three PRs, same recipe, different route sets. Each is independently green
except for the contract test, which shrinks with each and passes at the end of
PR 6.

**The recipe is Task 10 Step 2.** Read it again for each batch rather than
working from memory.

Limiter selection, by route family — use the existing singletons from
`app/lib/rate-limit.ts`, do not invent new ones:

| Family                                       | Limiter                  |
| -------------------------------------------- | ------------------------ |
| `ai/chat`, `ai/chat-stream`, `ai/regenerate` | `aiChatLimiter`          |
| `ai/transcribe`                              | `aiTranscribeLimiter`    |
| `ai/memory/extract`                          | `memoryExtractLimiter`   |
| `ai/memory`, `ai/memory/[key]`               | `memoryLimiter`          |
| `ai/suggestions`                             | `suggestionsLimiter`     |
| `account/*`                                  | `accountDeletionLimiter` |
| `auth/fallback/*`                            | `authLimiter`            |
| `tags/*`                                     | `tagLimiter`             |
| `templates/*`                                | `templateLimiter`        |
| `conversations/*/share*`                     | `shareLimiter`           |
| `share/[token]/join`                         | `shareJoinLimiter`       |
| `creators/*/tips`, `creators/*/subscription` | `creatorPaymentLimiter`  |
| `csrf`                                       | `csrfLimiter`            |
| everything else                              | `apiLimiter`             |

Cron routes (`app/api/cron/*`, 4 modules) use
`guard({ auth: "none", csrf: false, limiter: apiLimiter }, ...)` and keep their
existing `CRON_SECRET` check inside the handler. They stay inside the contract
rather than joining the allowlist.

### Task 12 (PR 4): conversations and messages — 20 routes

**Files:** every `route.ts` under `app/api/conversations/` (15) and
`app/api/messages/` (5).

- [ ] **Step 1: List the batch**

```bash
comm -23 <(find app/api/conversations app/api/messages -name route.ts | sort) \
         <(grep -rl "guard(" app/api --include=route.ts | sort)
```

- [ ] **Step 2: Migrate each, one file per commit**

For each file: read it whole, apply the Task 10 Step 2 pattern, then

```bash
set -a; source .env.ci.example; set +a
bun run typecheck && bun run test --runInBand app/__tests__/api
git add <the file> && git commit -m "refactor(api): move <route> onto guard()"
```

One file per commit keeps the diff reviewable and makes a bisect meaningful.

- [ ] **Step 3: Full gate and burn-down check**

```bash
set -a; source .env.ci.example; set +a
bun run lint && bun run typecheck && bun run test --runInBand \
  app/__tests__/api/route-guard-contract.test.ts 2>&1 | tail -5
```

Expected: 20 fewer failures.

- [ ] **Step 4: Open PR 4**

```bash
git push -u origin refactor/guard-conversations-and-messages
gh pr create --title "refactor(api): move conversations and messages onto guard()" --body "$(cat <<'EOF'
Batch 1 of 3 in the guard migration. Moves the 15 conversation routes and the
5 message routes off their hand-rolled request preambles and onto `guard()`,
deleting the per-route 401, CSRF block, Zod parse and outer try/catch that
`guard` already owns.

One commit per file, so the diff is reviewable and a bisect is meaningful.

The guard contract test added in PR 3 is still red and burns down by 20 here.
It goes green at the end of batch 3.

Spec: docs/superpowers/specs/2026-09-03-production-readiness-design.md

\U0001F916 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01MNwKYYjXdygHVZo7eW9jHS
EOF
)"
```

### Task 13 (PR 5): ai, characters and character-comments — 21 routes

**Files:** every `route.ts` under `app/api/ai/` (11), `app/api/characters/` (9),
`app/api/character-comments/` (1).

- [ ] **Step 1: List the batch**

```bash
comm -23 <(find app/api/ai app/api/characters app/api/character-comments -name route.ts | sort) \
         <(grep -rl "guard(" app/api --include=route.ts | sort)
```

- [ ] **Step 2: Migrate each, one file per commit** — as Task 12 Step 2.

`ai/chat-stream/route.ts` returns a `ReadableStream`, not a `NextResponse`.
Check whether `guard`'s return type accommodates it before converting; if it
does not, widen `guard`'s handler return type to
`Promise<NextResponse | Response>` in `app/lib/guarded-route.ts` and update the
two `NextResponse` returns in the catch and the helpers accordingly. Do that as
its own commit, with the contract test run before and after.

- [ ] **Step 3: Full gate and burn-down check** — as Task 12 Step 3, expecting 21 fewer.

- [ ] **Step 4: Open PR 5.**

### Task 14 (PR 6): the remainder — 37 routes, then green

**Files:** every remaining unmigrated `route.ts` — `templates` (5), `cron` (4),
`creators` (4), `auth` (3 after Task 10), `settings` (3), `account` (3),
`stripe` (2), `share` (2), `notifications` (1 after Task 10), `affiliate` (2),
`tags` (1), `search` (1), `personas` (1), `moderation` (1), `csrf` (1),
`health` (1).

- [ ] **Step 1: List what is left**

```bash
comm -23 <(find app/api -name route.ts | sort) \
         <(grep -rl "guard(" app/api --include=route.ts | sort)
```

Expected: 37 files, plus the 4 allowlisted ones.

- [ ] **Step 2: Migrate each, one file per commit** — as Task 12 Step 2.

`csrf` and `health` are public and take `guard({ auth: "none", csrf: false, limiter: csrfLimiter })`
and `guard({ auth: "none", csrf: false })` respectively. Do not allowlist them —
the guard expresses both fine.

- [ ] **Step 3: The contract test must now be green**

```bash
set -a; source .env.ci.example; set +a
bun run test app/__tests__/api/route-guard-contract.test.ts
```

Expected: PASS, with exactly 4 allowlisted routes.

- [ ] **Step 4: Full gate**

```bash
set -a; source .env.ci.example; set +a
bun run lint && bun run typecheck && bun run test --runInBand && \
  SKIP_ENV_VALIDATION=1 bun run build
```

- [ ] **Step 5: Confirm the original defect class is gone**

```bash
for f in $(find app/api -name route.ts); do
  if grep -qE "export (async function|const) (POST|PUT|PATCH|DELETE)" "$f" \
     && ! grep -qE "Limiter|limiter" "$f"; then echo "UNLIMITED: $f"; fi
done
```

Expected: only the 4 allowlisted routes, if any.

- [ ] **Step 6: Open PR 6** and note that the contract test goes green here.

---

## PR 7 — Docs, runbooks, and the support contact

### Task 15: Make the docs' own references checkable

**Files:**

- Create: `scripts/check-doc-references.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Produces: `bun run docs:check`, added to the `ci` job.

- [ ] **Step 1: Write the checker**

Create `scripts/check-doc-references.mjs`:

```js
#!/usr/bin/env node
/**
 * Verifies that every repo-relative path and `bun run <script>` a Markdown
 * document names actually exists.
 *
 * README.md linked a `runbooks/` directory that was never written, and
 * DEPLOYMENT.md instructed a script that was never added. Both read as true
 * for months because nothing checked them. Same principle as the route guard
 * contract: the claim is computed, not eyeballed.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "fs"
import { dirname, join } from "path"

const ROOT = process.cwd()
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "coverage",
  "playwright-report",
  "test-results",
])

function markdownFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...markdownFiles(full))
    else if (entry.endsWith(".md")) out.push(full)
  }
  return out
}

const scripts = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).scripts
const failures = []

// Markdown links to repo-relative paths: [text](path) where path is not a URL,
// not an anchor, and not a mailto.
const LINK = /\[[^\]]*\]\(([^)]+)\)/g
const BUN_RUN = /`bun run ([a-z0-9:_-]+)`/g

for (const file of markdownFiles(ROOT)) {
  const text = readFileSync(file, "utf8")
  const rel = file.slice(ROOT.length + 1)

  for (const [, target] of text.matchAll(LINK)) {
    if (/^(https?:|mailto:|#)/.test(target)) continue
    const clean = target.split("#")[0]
    if (!clean) continue
    const resolved = clean.startsWith("/") ? join(ROOT, clean) : join(dirname(file), clean)
    if (!existsSync(resolved)) failures.push(`${rel}: link to missing path "${target}"`)
  }

  for (const [, script] of text.matchAll(BUN_RUN)) {
    if (!(script in scripts)) failures.push(`${rel}: names missing script "bun run ${script}"`)
  }
}

if (failures.length > 0) {
  console.error("Documentation references that do not resolve:\n")
  for (const f of failures) console.error(`  ${f}`)
  console.error(`\n${failures.length} broken reference(s).`)
  process.exit(1)
}

console.log("All documentation references resolve.")
```

- [ ] **Step 2: Add the script and run it — it must fail**

In `package.json` scripts, after `design:check`:

```json
    "docs:check": "node scripts/check-doc-references.mjs",
```

```bash
bun run docs:check
```

Expected: FAIL, naming at minimum `README.md: link to missing path "runbooks/"`
and `DEPLOYMENT.md: names missing script "bun run ops:sentry:alerts:audit"`.

- [ ] **Step 3: Write the runbooks README promises**

`README.md:67` promises "operational runbooks for incidents, rollback, secrets,
Stripe, Sentry, and DB drills". Create `runbooks/` with one file per item —
`incidents.md`, `rollback.md`, `secrets.md`, `stripe.md`, `sentry.md`,
`db-drills.md` — plus `runbooks/README.md` indexing them. Move
`docs/runbooks/upstash-provisioning.md` (created in Task 8) to
`runbooks/upstash-provisioning.md` and index it too.

Each runbook states: when you reach for it, the exact commands, and how you know
it worked. Source the content from what is already verified — `DEPLOYMENT.md`
has the rollback procedure (`vercel rollback`, forward-only migrations) and the
Stripe and Sentry setup steps; the DB drill is the Docker rehearsal used in
Task 1.

- [ ] **Step 4: Fix the two false claims**

In `DEPLOYMENT.md:139-142`, delete the `bun run ops:sentry:alerts:audit`
instruction and replace it with the manual Sentry alert-rule audit steps, or
write the script. Deleting the claim is acceptable; leaving it is not.

In `CLAUDE.md`, correct "Repo is private; Actions minutes are capped, so nothing
else is scheduled" — the repo is public and minutes are unlimited, which is
what makes PR 1 possible.

- [ ] **Step 5: Re-run the checker**

```bash
bun run docs:check
```

Expected: `All documentation references resolve.`

- [ ] **Step 6: Wire it into CI**

In the `ci` job of `.github/workflows/ci.yml`, after the `design:check` step:

```yaml
- run: bun run docs:check
```

- [ ] **Step 7: Commit**

```bash
git add scripts/check-doc-references.mjs package.json .github/workflows/ci.yml \
  runbooks/ README.md DEPLOYMENT.md CLAUDE.md
git rm -r --cached docs/runbooks 2>/dev/null || true
git commit -m "docs: write the promised runbooks, and check that documents tell the truth"
```

### Task 16: Centralize the support address

`support@infinistar.app` is hardcoded in 8 files. One is
`app/(docs)/privacy/page.tsx`, where it is the GDPR data-rights contact — a
legal document naming an address on a domain that does not resolve.

**Files:**

- Create: `app/lib/support.ts`
- Modify: the 8 files below
- Test: `app/__tests__/lib/support.test.ts` (create)

**Interfaces:**

- Produces: `SUPPORT_EMAIL: string` and `SUPPORT_MAILTO: string`.

- [ ] **Step 1: Find every occurrence**

```bash
grep -rn "support@infinistar.app\|infinistar\.app" app --include="*.ts" --include="*.tsx" | grep -v __tests__
```

Expected: `AuthFormBoundary.tsx:31`, `AuthShell.tsx:142,145`,
`UpgradeModal.tsx:35`, `email-templates.ts:419,437`,
`AccountTabContent.tsx:168`, `privacy/page.tsx:220,255,285`.

- [ ] **Step 2: Write the failing test**

Create `app/__tests__/lib/support.test.ts`:

```ts
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/app/lib/support"

describe("support contact", () => {
  it("is a syntactically valid address", () => {
    expect(SUPPORT_EMAIL).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i)
  })

  it("is not on the domain that does not resolve", () => {
    expect(SUPPORT_EMAIL).not.toContain("infinistar.app")
  })

  it("exposes a mailto for link hrefs", () => {
    expect(SUPPORT_MAILTO).toBe(`mailto:${SUPPORT_EMAIL}`)
  })
})
```

- [ ] **Step 3: Create the module**

```ts
/**
 * The support address, in one place.
 *
 * It was hardcoded in eight modules, one of them the privacy policy, where it
 * is the GDPR data-rights contact — so a dead address there is a legal
 * defect, not a cosmetic one. `support@infinistar.app` was dead: that domain
 * is NXDOMAIN and the canonical domain is infini-star.vercel.app, which
 * cannot receive mail.
 *
 * Overridable per-environment so a change never means touching eight files
 * again.
 */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "OWNER_MUST_SET"

export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`
```

**Owner-blocked:** the default value. Replace `"OWNER_MUST_SET"` with the real
address once the owner supplies it. Do not ship this default — the test in
Step 2 fails on it, which is intentional and is the reminder.

- [ ] **Step 4: Replace all 8 occurrences**

Import `SUPPORT_EMAIL` / `SUPPORT_MAILTO` and substitute. In `AuthShell.tsx` and
`AccountTabContent.tsx` the `href="mailto:..."` becomes `href={SUPPORT_MAILTO}`.
In `privacy/page.tsx` the address appears as visible prose three times — use
`{SUPPORT_EMAIL}`.

`email-templates.ts` builds plain-text and HTML bodies; interpolate there too.

- [ ] **Step 5: Add a grep guard to CI**

In `.github/workflows/ci.yml`, in the `ci` job after `docs:check`:

```yaml
- name: No module may hardcode the support address
  run: |
    if grep -rn "support@" app --include="*.ts" --include="*.tsx" \
       | grep -v "app/lib/support.ts" | grep -v "__tests__"; then
      echo "Hardcoded support address. Import SUPPORT_EMAIL from app/lib/support."
      exit 1
    fi
```

- [ ] **Step 6: Full gate and commit**

```bash
set -a; source .env.ci.example; set +a
bun run lint && bun run typecheck && bun run test --runInBand && bun run docs:check
git add app/lib/support.ts app/__tests__/lib/support.test.ts app/components app/lib/email-templates.ts \
  "app/(docs)/privacy/page.tsx" "app/(dashboard)/dashboard/profile/components/AccountTabContent.tsx" \
  .github/workflows/ci.yml
git commit -m "fix(support): one support address, and a check that no module hardcodes it"
```

### Task 17: Move the server-side console calls to the logger

36 `console.*` calls remain. 31 are in client components and hooks, where
`console.error` is the correct browser behavior and pino is not — those stay.
The 5 in `app/lib` are server-side and should be structured.

**Files:**

- Modify: the 5 files named by the grep in Step 1.

- [ ] **Step 1: Find them**

```bash
grep -rn "console\.\(log\|error\|warn\|info\)" app/lib --include="*.ts"
```

- [ ] **Step 2: Replace each with the matching logger**

Use the named logger for the module's domain (`apiLogger`, `authLogger`,
`dbLogger`). Errors take the pino shape: `logger.error({ err: error }, "message")`,
not `logger.error(error)`.

- [ ] **Step 3: Full gate and commit**

```bash
set -a; source .env.ci.example; set +a
bun run lint && bun run typecheck && bun run test --runInBand
git add app/lib
git commit -m "chore(logging): structure the five server-side console calls"
```

### Task 18: Make a production Redis fallback page someone

The 503 stood for long enough that nobody noticed, which says more about
alerting than about Redis. The spec calls for alerting on health degradation.

A scheduled probe is the obvious answer and the wrong one here: Vercel's cron
granularity on this project's plan is daily (every existing cron in
`vercel.json` runs once a day), so a probe would find a Redis outage up to 24
hours late. The stronger signal is already available — when
`getRedisClient()` returns null in production, that IS the degradation, and it
happens on real traffic rather than on a timer.

**Files:**

- Modify: `app/lib/redis.ts`
- Test: `app/__tests__/lib/redis.test.ts` (extend the file created in Task 6)

**Interfaces:**

- Consumes: `getRedisClient` from Task 6.
- Produces: no new exports. The behavior change is a Sentry report on the
  production fallback path.

- [ ] **Step 1: Write the failing test**

Append to `app/__tests__/lib/redis.test.ts`:

```ts
describe("production fallback reporting", () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("reports to Sentry when it falls back in production", async () => {
    const captureMessage = jest.fn()
    jest.doMock("@sentry/nextjs", () => ({ captureMessage }))
    process.env.NODE_ENV = "production"

    const { getRedisClient } = await import("@/app/lib/redis")
    expect(getRedisClient()).toBeNull()

    expect(captureMessage).toHaveBeenCalledWith(
      expect.stringContaining("in-memory"),
      expect.objectContaining({ level: "error" })
    )
  })

  it("stays quiet when it falls back outside production", async () => {
    const captureMessage = jest.fn()
    jest.doMock("@sentry/nextjs", () => ({ captureMessage }))
    process.env.NODE_ENV = "development"

    const { getRedisClient } = await import("@/app/lib/redis")
    expect(getRedisClient()).toBeNull()

    expect(captureMessage).not.toHaveBeenCalled()
  })

  it("reports once, not on every call", async () => {
    const captureMessage = jest.fn()
    jest.doMock("@sentry/nextjs", () => ({ captureMessage }))
    process.env.NODE_ENV = "production"

    const { getRedisClient } = await import("@/app/lib/redis")
    getRedisClient()
    getRedisClient()
    getRedisClient()

    expect(captureMessage).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
set -a; source .env.ci.example; set +a
bun run test app/__tests__/lib/redis.test.ts
```

Expected: FAIL — `captureMessage` is never called.

- [ ] **Step 3: Report the fallback**

In `app/lib/redis.ts`, add the import and extend the unconfigured branch:

```ts
import { captureMessage } from "@sentry/nextjs"
```

```ts
if (!url || !token) {
  const message =
    "Upstash is not configured. Falling back to in-memory storage. " +
    "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for " +
    "distributed rate limiting and 2FA token storage."

  dbLogger.warn(message)

  // In production this is not a warning, it is an outage: rate limiting and
  // 2FA tokens silently become per-instance, which on serverless is not
  // enforcement. `connectionAttempted` is already true, so this runs once
  // per cold start rather than once per request.
  if (process.env.NODE_ENV === "production") {
    captureMessage(message, { level: "error" })
  }

  return null
}
```

- [ ] **Step 4: Run the tests**

```bash
set -a; source .env.ci.example; set +a
bun run test app/__tests__/lib/redis.test.ts
```

Expected: 7 passed (4 from Task 6, 3 new).

- [ ] **Step 5: Record the alerting requirement in the runbook**

Append to `runbooks/upstash-provisioning.md`:

```markdown
## Alerting

A production fallback to in-memory storage now reports to Sentry as an error,
once per cold start, with the message beginning "Upstash is not configured".

Confirm a Sentry alert rule fires on it: Sentry → Alerts → an issue alert on
`level:error`, delivered somewhere a person actually reads. Without that rule
the report is only visible to someone already looking at Sentry, which is the
condition that let the original 503 stand.
```

- [ ] **Step 6: Full gate and commit**

```bash
set -a; source .env.ci.example; set +a
bun run lint && bun run typecheck && bun run test --runInBand
git add app/lib/redis.ts app/__tests__/lib/redis.test.ts runbooks/upstash-provisioning.md
git commit -m "fix(redis): report a production in-memory fallback to Sentry"
```

### Task 19: Open PR 7

- [ ] **Step 1: Push and open**

```bash
git push -u origin docs/runbooks-and-support-contact
gh pr create --title "docs: write the promised runbooks, check that documents tell the truth" --body "$(cat <<'EOF'
Three documented claims were false: README linked a `runbooks/` directory that
did not exist, DEPLOYMENT.md instructed a script that did not exist, and
CLAUDE.md said the repo is private when it is public.

Writes the runbooks, corrects the other two, and adds `bun run docs:check` —
which verifies every repo-relative path and `bun run` script a Markdown file
names actually resolves. Same principle as the route guard contract: the
claim is computed, not eyeballed.

Also centralizes `support@infinistar.app`, which was hardcoded in eight files
including the privacy policy, where it is the GDPR data-rights contact — a
dead address on an NXDOMAIN domain.

Spec: docs/superpowers/specs/2026-09-03-production-readiness-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01MNwKYYjXdygHVZo7eW9jHS
EOF
)"
```

---

## PR 8 — Coverage to the tiered thresholds

### Task 20: Raise coverage where blast radius is highest

Order follows blast radius, not file count: `app/actions` is 6.3% covered and
every page depends on it.

**Files:**

- Create: test files under `app/__tests__/actions/` and `app/__tests__/api/`.

- [ ] **Step 1: Establish the per-directory picture**

```bash
set -a; source .env.ci.example; set +a
bun run test:coverage --runInBand > /dev/null 2>&1
node -e "
const fs=require('fs');
const s=JSON.parse(fs.readFileSync('coverage/coverage-final.json','utf8'));
const b={};
for(const [k,v] of Object.entries(s)){
 const rel=k.replace(process.cwd()+'/','');
 const st=Object.values(v.s||{});
 b[rel]={cov:st.filter(x=>x>0).length,tot:st.length};}
Object.entries(b).filter(([,v])=>v.tot>20).sort((a,b)=>(a[1].cov/a[1].tot)-(b[1].cov/b[1].tot))
 .slice(0,40).forEach(([f,v])=>console.log((100*v.cov/v.tot).toFixed(0).padStart(4)+'%  '+String(v.tot).padStart(5)+'  '+f));
"
```

This ranks files by _uncovered statements_, so the work is ordered by what
actually moves the number.

- [ ] **Step 2: Cover `app/actions` first**

Ten files, 6.3% covered, 126 statements. Every one is a server-side data fetch
with a small surface: mock `@/app/lib/prismadb` and `getCurrentUser`, assert the
query shape and the null-user path. Write one suite per action file under
`app/__tests__/actions/`.

The mock preamble every one of these needs — the logger shape is load-bearing
per the Global Constraints:

```ts
jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    conversation: { findMany: jest.fn(), findUnique: jest.fn() },
  },
}))

jest.mock("@/app/lib/logger", () => ({
  __esModule: true,
  default: { child: jest.fn(() => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() })) },
  apiLogger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
  authLogger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
  dbLogger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}))
```

- [ ] **Step 3: Raise `app/api` to 80%**

Now that every route is guarded, route tests get simpler: the preamble is
`guard`'s, tested once. Each route test asserts the handler's own logic, with
`guard` exercised through it.

- [ ] **Step 4: Raise `app/lib` to 80%** — same approach, ranked by Step 1.

- [ ] **Step 5: Re-measure after each group**

```bash
set -a; source .env.ci.example; set +a
bun run test:coverage --runInBand 2>&1 | grep -A3 "^All files"
```

Commit after each group rather than at the end.

### Task 21: Raise the thresholds to the target

**Files:**

- Modify: `jest.config.js`

- [ ] **Step 1: Confirm the targets are met**

```bash
set -a; source .env.ci.example; set +a
bun run test:coverage --runInBand 2>&1 | grep -E "^(All files|app/lib|app/api)"
```

Expected: global statements ≥ 60, `app/lib` ≥ 80, `app/api` ≥ 80.

- [ ] **Step 2: Set the tiered thresholds**

Replace the `coverageThreshold` block from PR 1 Task 4:

```js
  // Raised deliberately, never lowered to make a build pass. `lib` and `api`
  // carry the money and auth paths, so they hold a higher floor than the
  // global one.
  coverageThreshold: {
    global: { statements: 60, branches: 50, functions: 55, lines: 60 },
    "./app/lib/**/*.ts": { statements: 80, branches: 70, functions: 75, lines: 80 },
    "./app/api/**/*.ts": { statements: 80, branches: 70, functions: 75, lines: 80 },
  },
```

- [ ] **Step 3: Verify**

```bash
set -a; source .env.ci.example; set +a
bun run test:coverage --runInBand 2>&1 | tail -5
```

Expected: exit 0, no threshold failure.

- [ ] **Step 4: Commit and open PR 8**

```bash
git add jest.config.js app/__tests__
git commit -m "test: raise coverage to the tiered floors and enforce them"
git push -u origin test/coverage-to-tiered-floors
gh pr create --title "test: raise coverage to the tiered floors" --body "$(cat <<'EOF'
1180 tests produced 29% statement coverage, because they concentrated on `lib`
and `api` while `app/actions` sat at 6.3% with every page depending on it.

Raises coverage in blast-radius order — actions, then api, then lib — and
replaces the floor pinned in PR 1 with the tiered thresholds: `app/lib` and
`app/api` at 80%, global at 60%. Enforced in CI, so it cannot regress.

Spec: docs/superpowers/specs/2026-09-03-production-readiness-design.md

\U0001F916 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01MNwKYYjXdygHVZo7eW9jHS
EOF
)"
```

---

## Done means

- `curl -s https://infini-star.vercel.app/api/health` returns HTTP 200 with `"redis":"connected"`.
- `gh api repos/gr8monk3ys/InfiniStar/branches/master/protection --jq '.required_status_checks.contexts'` returns `["CI","integration","e2e"]`.
- `bun run test app/__tests__/api/route-guard-contract.test.ts` passes with exactly 4 allowlisted routes, each carrying a reason.
- `bun run test:coverage` passes the tiered thresholds.
- `bun run docs:check` reports all references resolve.
- A production fallback to in-memory storage reports to Sentry once per cold start.
- No file under `app/` outside `app/lib/support.ts` contains a hardcoded support address.

## Owner-blocked items

Neither can be completed without the owner; both are staged so that the owner's
step is the only one left.

1. **Upstash provisioning** — `runbooks/upstash-provisioning.md`, written in
   Task 8. Until it is done, production keeps returning 503 and rate limiting
   stays per-instance.
2. **The support address** — `app/lib/support.ts` ships with a placeholder that
   deliberately fails its own test until a real address is supplied.
