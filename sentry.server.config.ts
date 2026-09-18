import * as Sentry from "@sentry/nextjs"

import { SENTRY_ENABLED, SENTRY_ENV } from "@/app/lib/sentry-enabled"

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  tracesSampleRate: 0.1,
  environment: SENTRY_ENV,
  // A DSN alone is not enough: without SENTRY_ENABLED a local
  // `next build && next start` reports into the shared production error
  // quota. See app/lib/sentry-enabled.ts.
  enabled: Boolean(dsn) && SENTRY_ENABLED,
})
