# Database backups

- `backup_db.sh` — dumps the database to `backend/backups/ischool_<timestamp>.sql.gz`, keeps the last 14 days locally (`KEEP_DAYS` to override), and uploads off-site if `BACKUP_S3_BUCKET` is set.
- `restore_db.sh <dump.sql.gz>` — restores a dump. **Destructive** — asks for confirmation unless you pass `-f`.
- `upload_backup_offsite.sh <file>` — pushes one file to S3-compatible storage (AWS S3, Cloudflare R2, Backblaze B2 via `BACKUP_S3_ENDPOINT`). Called automatically by `backup_db.sh` when configured.

Both scripts run `pg_dump`/`psql` inside the `ischool-db-1` Docker container (`DB_CONTAINER` to override) so the client version always matches the server, and fall back to the host's `pg_dump`/`psql` if the container isn't running (e.g. a bare-metal Postgres in production).

## Scheduled backups

A cron job runs `backup_db.sh` daily at 2am on this machine, logging to `backend/backups/backup.log`:

```
0 2 * * * /home/bruno-sharrix/Downloads/ischool/backend/scripts/backup_db.sh >> /home/bruno-sharrix/Downloads/ischool/backend/backups/backup.log 2>&1
```

Check it: `crontab -l`. Remove it: `crontab -e` and delete the line.

**This only protects against this specific machine's disk failing if backups also go off-site.** Set these env vars (in `backend/.env` or the shell running cron) to enable that:

```
BACKUP_S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
BACKUP_S3_ENDPOINT=https://...   # only needed for R2/B2, not AWS S3
```

Until those are set, backups are local-only — real, but they die with this machine. On a production server this same cron entry (with S3 vars set) is the whole story; no code changes needed.

## Restore drill (do this periodically, not just when you need it)

```bash
./restore_db.sh backups/ischool_<timestamp>.sql.gz -f
```

Test this against a scratch database before you ever need it against the real one — see the verification done when this was first set up (dumped, restored into `ischool_restore_test`, and diffed row counts across `users`, `students`, `schools`, `results`, `fee_invoices` — all matched).
