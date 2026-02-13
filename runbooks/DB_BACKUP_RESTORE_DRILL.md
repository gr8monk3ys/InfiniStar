# DB Backup and Restore Drill

Run this drill regularly to verify backup recoverability.

## Frequency

- Weekly for staging
- Monthly for production-like data in isolated drill environment

## Preconditions

- `DATABASE_URL` points to source database
- `DRILL_DATABASE_URL` points to isolated restore target (must be different from source)
- `pg_dump`, `pg_restore`, and `psql` installed

## Drill Command

```bash
DATABASE_URL="postgresql://..." \
DRILL_DATABASE_URL="postgresql://..." \
npm run ops:db:backup-restore:drill
```

## What The Script Verifies

1. Backup artifact is created and non-empty.
2. Backup restores cleanly into drill DB.
3. Restored DB has expected public schema table count.

## Post-Drill Requirements

- Attach command output to ops ticket.
- Store backup artifact retention metadata (path + timestamp).
- Record restoration duration.
- Log any failed step and corrective action.
