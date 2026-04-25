# Postgres — local dev + test stack

## Start

    docker compose -f db/postgres/docker-compose.test.yml up -d

Postgres listens on `localhost:5433` (port 5433, not 5432). Default
credentials are `hydrax/hydrax/hydrax`. Connection string:

    postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable

Set `DATABASE_URL` to that string before running `db/postgres/apply.sh`
or the workflow-svc tests, or accept the script default which matches.

## Apply migrations

    db/postgres/apply.sh

Applies every `migrations/*.sql` file in lexical order. Requires `psql`
on PATH.

## Stop / wipe

    docker compose -f db/postgres/docker-compose.test.yml down       # stop
    docker compose -f db/postgres/docker-compose.test.yml down -v    # stop + delete data

## Adding a migration

Drop a new file at `migrations/NNNN_<description>.sql` where `NNNN` is
the next zero-padded number. The current applier does not track which
migrations have run — it re-runs them all. For greenfield this is fine
because each file uses `CREATE` (not `IF NOT EXISTS`) and will fail
loudly on a re-apply.

When we have data we cannot drop, we'll switch to `golang-migrate` —
not before.
