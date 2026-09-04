# Provisioning Upstash

Owner-only: needs Vercel dashboard access.

Production has been serving HTTP 503 from `/api/health` because `REDIS_URL` was
set to an unreachable value. Rate limiting and 2FA token storage were silently
falling back to per-instance in-memory storage, which on serverless is not
enforcement.

The code no longer reads `REDIS_URL` at all. It reads
`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, and until those are
set, production stays degraded.

## Steps

1. Vercel dashboard → the `infini-star` project → **Storage** → **Upstash
   Redis** → create a database in the region closest to the deployment. The
   free tier (500K commands/month) covers current traffic by roughly three
   orders of magnitude.
2. Accept the integration's offer to add `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN` to Production, Preview and Development.
3. **Delete the stale `REDIS_URL`** from every environment. Nothing reads it
   any more; leaving it is a trap for the next person who greps for it.
4. Redeploy production.
5. Verify:

   ```bash
   curl -s https://infini-star.vercel.app/api/health
   ```

   Expected: HTTP 200 and `{"status":"ok",...,"redis":"connected"}`.
   Anything else means step 2 or step 4 did not take.

## Alerting

A production fallback to in-memory storage now reports to Sentry as an error,
once per cold start, with a message beginning "Upstash is not configured".

Confirm a Sentry alert rule fires on it: Sentry → Alerts → an issue alert on
`level:error`, delivered somewhere a person actually reads.

Without that rule the report is only visible to someone already looking at
Sentry, which is the condition that let the original 503 stand for days.

## Why not a scheduled health probe

It was the obvious alternative and is worse here. Every cron in `vercel.json`
runs daily, which is this project's granularity, so a probe would find a Redis
outage up to 24 hours late. Reporting from the fallback path fires on real
traffic instead.
