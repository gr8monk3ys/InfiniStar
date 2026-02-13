# Canary Deployment and Rollback Runbook

## Goal

Reduce release risk by validating changes on a small traffic slice before full rollout.

## Canary Steps

1. Pre-check
   - `npm run ci:release:gate` passing on release commit
   - No open `SEV1` incidents
2. Deploy canary
   - Route 5% traffic to canary for 15 minutes
3. Observe
   - Error rate, p95 latency, checkout success rate, webhook success
4. Expand
   - Increase to 25% for 15 minutes if metrics stable
5. Full rollout
   - Move to 100% once thresholds stay healthy

## Rollback Triggers

- Error rate increases by >2x baseline
- p95 latency exceeds SLO by >30%
- Payment failures spike above normal baseline

## Rollback Procedure

1. Route 100% traffic back to previous stable version.
2. Confirm health endpoints and key user journeys.
3. Freeze further deployments until root cause is identified.

## Evidence to Capture

- Canary start/end timestamps
- Traffic percentage changes
- Metrics snapshots at each stage
- Rollback timestamp (if applicable)
