/**
 * Production migrations — plain Node, no drizzle-kit.
 * Usage: node dist/migrate.js
 */
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { buildDatabaseConfig } from "./app/config/databaseConfig.ts";

const config = buildDatabaseConfig();
const pool = new pg.Pool({
  host: config.host,
  port: config.port,
  user: config.username,
  password: config.password,
  database: config.database,
  ssl: config.ssl,
});

const db = drizzle(pool);
/** Folder is copied next to the app root in Docker (`/app/drizzle`). */
const migrationsFolder = path.join(process.cwd(), "drizzle");

const main = async () => {
  console.log(`Migrating database "${config.database}"…`);
  await migrate(db, { migrationsFolder });
  console.log("✅ Migrations applied");
  await pool.end();
};

main().catch(async (err) => {
  console.error("❌ Migration failed:", err);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
