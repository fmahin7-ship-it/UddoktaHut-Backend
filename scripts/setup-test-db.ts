/**
 * Ensure uddoktahut_test exists, has schema, and has plan rows (for npm test).
 *
 * Usage: npm run db:prepare-test
 */
import dotenv from "dotenv";
import { execSync } from "node:child_process";
import pg from "pg";

dotenv.config();

const host = process.env.DB_HOST || "localhost";
const port = Number(process.env.DB_PORT) || 5432;
const user = process.env.DB_USER || "postgres";
const password = process.env.DB_PASS || "";
const testDb = process.env.DB_NAME_TEST || "uddoktahut_test";

const admin = new pg.Pool({
  host,
  port,
  user,
  password,
  database: "postgres",
});

const main = async () => {
  const exists = await admin.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [testDb]
  );
  if (exists.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${testDb}"`);
    console.log(`Created database ${testDb}`);
  } else {
    console.log(`Database ${testDb} already exists`);
  }
  await admin.end();

  process.env.DB_NAME = testDb;
  process.env.USE_TEST_DB = "true";
  process.env.DB_NAME_TEST = testDb;
  process.env.NODE_ENV = process.env.NODE_ENV || "test";

  execSync("npx drizzle-kit migrate", {
    stdio: "inherit",
    env: { ...process.env, DB_NAME: testDb },
  });

  // Roles + plans + plan_prices come from drizzle/0001_seed_reference_data.sql
  console.log(`✅ Test DB ${testDb} is migrated (reference data included)`);
};

main().catch(async (err) => {
  console.error(err);
  await admin.end().catch(() => undefined);
  process.exit(1);
});

