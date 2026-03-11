Migration guide (Docker-based)

This is a minimal, self-contained migration setup that uses Docker Compose to:
- start a MySQL server and load `enrollments.sql` into `enrollments_db`
- start a PostgreSQL server with database `compostela-sms`
- run `pgloader` to migrate the MySQL data into PostgreSQL

Files added:
- `docker-compose.migration.yml` — Compose definition for `mysql`, `postgres`, and `pgloader` services
- `my_migration.load` — pgloader load file (configured to talk to the compose services)

Quick steps (on your Windows host, from project folder):

1) Install Docker Desktop and make sure it's running.
2) Open a PowerShell or CMD in `C:\Users\icile\OneDrive\Desktop\SMS`.
3) Run:

```powershell
docker compose -f docker-compose.migration.yml up --build
```

What happens:
- MySQL starts and the `enrollments.sql` file is loaded automatically into `enrollments_db` (via the image init script).
- Postgres starts and creates database `compostela-sms` with user `pg_user` / password `pgpass`.
- The `pgloader` container waits until both DBs are healthy and then runs `pgloader my_migration.load` to migrate data.

Default credentials used in the compose (change before production):
- MySQL root password: `rootpass`
- PostgreSQL user: `pg_user` / password: `pgpass`

If `pgloader` finishes, the container will exit and compose will show logs. When done, shut down containers:

```powershell
docker compose -f docker-compose.migration.yml down
```

Notes and next steps:
- This is intentionally minimal and uses insecure default passwords for convenience. Change passwords before using in any sensitive environment.
- After migration, connect to Postgres and run the sequence resets and boolean conversions as needed (examples below):

```sql
-- reset serial for students.id
SELECT setval(pg_get_serial_sequence('students','id'), coalesce((SELECT max(id) FROM students),0));
-- convert tinyint flags to boolean
ALTER TABLE students ALTER COLUMN is_active TYPE boolean USING (is_active::int = 1);
```

- If `pgloader` fails due to zero-dates ("0000-00-00 00:00:00"), edit the MySQL data or preprocess the dump to replace zero-dates with NULLs before running.

If you want, I can:
- update compose to accept credentials from an `.env` file,
- add a small script to run the post-migration SQL automatically,
- or produce a non-Docker path using WSL-native `pgloader` and local MySQL/Postgres.

