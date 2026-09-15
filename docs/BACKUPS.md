# Backups and restore

Two layers, not one. Either alone is not enough: Supabase's own backups
protect against most disasters, but the exported copy in `backups` gives
a restore point independent of the Supabase project itself, readable
with nothing but standard Postgres tools.

## Layer 1: Supabase's own automated backups

Once the database actually lives on Supabase (as of Phase 7 it still
runs on a local Postgres install for development, `DATABASE_URL` and
`DIRECT_URL` in `.env` both point at `localhost`), Supabase takes daily
backups automatically, kept for 7 days on the free tier and longer on
paid plans, with point in time recovery available on paid plans. This
needs no code and no schedule of its own: it is a dashboard setting
under Database > Backups in the Supabase project.

**To restore from one:** open the Supabase dashboard, Database > Backups,
choose a backup or a point in time, and follow the restore flow there.
Restoring in place replaces the live database, so do this only against a
project you mean to roll back, never as a first troubleshooting step.

## Layer 2: a scheduled logical export

`scripts/backup.mjs` runs `pg_dump` against `DIRECT_URL` (the direct,
non-pooled connection Prisma Migrate also uses) and uploads the result
to a private `backups` bucket in Supabase Storage, under
`database/backup-<timestamp>.dump`. This is verified working end to end:
a real dump was produced, uploaded, downloaded back and confirmed
readable by `pg_restore --list` while building this.

### Running it manually

```
pnpm db:backup
```

Needs `DIRECT_URL`, `SUPABASE_URL` and `SUPABASE_SECRET_KEY` set (the
same three values already in `.env` for the app itself), and `pg_dump`
on the PATH, matching the Postgres server's own major version (17, as
installed for local development; Supabase's Postgres version should be
checked before assuming that copy of `pg_dump` matches it exactly, a
mismatch a version or two apart is normally still fine).

### Running it on a schedule

`.github/workflows/backup.yml` runs the same script daily, on GitHub's
own free scheduled runner. It needs four repository secrets, added under
the repository's Settings > Secrets and variables > Actions (this is a
manual step, nobody can set repository secrets from application code):

- `DIRECT_URL`: the same value as in `.env`, pointed at whichever
  database should be backed up (once that is Supabase, its own direct
  connection string, not the pooled one, and not the local development
  one this currently points at).
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

Without these secrets set, the scheduled workflow will run and fail
loudly (a red X in the Actions tab), rather than silently doing nothing.

## Restoring from a logical export

Download the `.dump` file from the `backups` bucket (Supabase dashboard,
Storage > backups > database, or the Supabase CLI), then, against the
target database:

```
pg_restore --clean --if-exists --no-owner --no-acl \
  --dbname "$DIRECT_URL" \
  backup-<timestamp>.dump
```

`--clean --if-exists` drops each object before recreating it, so this is
safe to run against a database that already has the old schema in it,
but it is still a destructive operation against whatever `DIRECT_URL`
points at: double check that value before running it, and prefer
restoring into a fresh, empty database first to verify the dump before
ever pointing this at a live one.

To verify a dump without restoring anything (what was done to confirm
this mechanism actually works, rather than trusting the code):

```
pg_restore --list backup-<timestamp>.dump
```

This lists every object the archive contains without touching any
database, and is worth doing on a fresh export occasionally, so a broken
backup is caught long before it is ever actually needed.
