# Database migrations (Drizzle)

## Status

- Sequelize `migrations/` and `seeders/` were removed; history remains in Git.
- Migrations are generated into `drizzle/` via Drizzle Kit.
- Local development may still use `drizzle-kit push` / `db:sync-dev`.
- **Production must use `npm run db:migrate`**, never `push --force`.

## Baseline (first Drizzle migration)

`drizzle/0000_*.sql` starts with:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

so a fresh database (CI, new server) can migrate cleanly when using a **pgvector** Postgres image.

### Existing production (schema already there)

Do **not** run the baseline DDL again. Stamp it instead (rehearse on a prod copy first):

```bash
# 1) Optional: compare schema
#    npx drizzle-kit pull   # against a prod copy, then diff with app/db/schema/

# 2) Mark baseline applied without running SQL
DB_NAME=your_prod_db npm run db:stamp-baseline
```

`db:stamp-baseline` inserts the migration hash into `drizzle.__drizzle_migrations`.

## Ongoing

```bash
# After schema edits
npm run db:generate
npm run db:migrate   # local / CI / prod
```

## Reference data (roles / plans / prices)

`drizzle/0001_seed_reference_data.sql` inserts roles, plans, and market prices.
It is idempotent (`ON CONFLICT` / `WHERE NOT EXISTS`).

Optional data stays in scripts:

| Script | Purpose |
|--------|---------|
| `npm run seed-intent-utterances` | AI routing embeddings (calls OpenAI) |
| `npm run seed-products` | Demo products for one store |

## Test database

```bash
# Once (or after wiping the volume)
npm run db:prepare-test   # creates uddoktahut_test + migrates (incl. 0001)

# .env
DB_NAME_TEST=uddoktahut_test

# npm test always points at DB_NAME_TEST via tests/setup-env.ts
npm test
```


## Production container (no drizzle-kit)

```bash
npm run build
node dist/migrate.js    # uses drizzle-orm migrator + SSL via buildDatabaseConfig
node dist/main.js
```

Docker image runs as `USER node`. Deploy step: `node dist/migrate.js && node dist/main.js`.

## CI

GitHub Actions (`.github/workflows/ci.yml`) typechecks, migrates an empty pgvector DB, runs tests, and builds.

Pin Node with `.nvmrc` (`22`) — same as Dockerfile and CI.

## Money columns

`products.price` and order totals still use Postgres `numeric` (returned as strings by `pg`). Prefer integer minor units in a later migration; do not add strings as numbers in application code.
