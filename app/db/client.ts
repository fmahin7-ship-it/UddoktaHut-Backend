import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { buildDatabaseConfig } from "../config/databaseConfig.ts";
import { schema } from "./schema/index.ts";

const { Pool } = pg;
const config = buildDatabaseConfig();

export const pool = new Pool({
  host: config.host,
  port: config.port,
  user: config.username,
  password: config.password,
  database: config.database,
  ssl: config.ssl,
  max: 20,
});

export const db = drizzle(pool, { schema });

export type Database = typeof db;

/** Verify the pool can reach Postgres. Replaces Sequelize authenticate/sync. */
export const connectDatabase = async (): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
};
