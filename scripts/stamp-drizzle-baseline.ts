/**
 * One-off: mark the Drizzle baseline migration as already applied
 * WITHOUT running its DDL. Use on a production (or prod-copy) DB that
 * already has the schema from the old Sequelize era.
 *
 * Rehearse on a prod copy first. See docs/MIGRATIONS.md.
 *
 * Usage:
 *   DB_NAME=your_db npm run db:stamp-baseline
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { buildDatabaseConfig } from "../app/config/databaseConfig.ts";

const config = buildDatabaseConfig();

const journalPath = path.join(process.cwd(), "drizzle", "meta", "_journal.json");
const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
  entries: Array<{ tag: string; when: number; idx: number }>;
};

const first = journal.entries[0];
if (!first) {
  console.error("No migrations in drizzle/meta/_journal.json");
  process.exit(1);
}

const sqlPath = path.join(process.cwd(), "drizzle", `${first.tag}.sql`);
const sql = fs.readFileSync(sqlPath, "utf8");
const hash = crypto.createHash("sha256").update(sql).digest("hex");

const pool = new pg.Pool({
  host: config.host,
  port: config.port,
  user: config.username,
  password: config.password,
  database: config.database,
  ssl: config.ssl,
});

const main = async () => {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const existing = await pool.query(
    `SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = $1`,
    [hash]
  );
  if ((existing.rowCount ?? 0) > 0) {
    console.log(
      `Baseline ${first.tag} already stamped (hash ${hash.slice(0, 12)}…)`
    );
    await pool.end();
    return;
  }

  await pool.query(
    `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
    [hash, first.when]
  );

  console.log(
    `✅ Stamped baseline ${first.tag} on database "${config.database}"`
  );
  console.log(`   hash=${hash}`);
  await pool.end();
};

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
