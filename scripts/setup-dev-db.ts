/**
 * Dev DB: pgvector + Drizzle schema push (replaces Sequelize sync).
 *
 * Usage: npm run db:sync-dev
 */
import dotenv from "dotenv";
import { execSync } from "node:child_process";
import { connectDatabase, pool } from "../app/db/client.ts";
import { queryExecute } from "../app/db/sql.ts";

dotenv.config();

const ensurePgvectorIntentTable = async () => {
  await queryExecute(`CREATE EXTENSION IF NOT EXISTS vector`);

  await queryExecute(`
    CREATE TABLE IF NOT EXISTS tool_routing (
      id SERIAL PRIMARY KEY,
      example_question TEXT NOT NULL,
      tool_name VARCHAR(64) NOT NULL,
      locale VARCHAR(8) NOT NULL DEFAULT 'any',
      embedding vector(1536) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await queryExecute(`
    CREATE INDEX IF NOT EXISTS tool_routing_embedding_idx
    ON tool_routing
    USING hnsw (embedding vector_cosine_ops)
  `);
};

const setupDevDb = async () => {
  try {
    await connectDatabase();
    console.log("DB connected");

    execSync("npx drizzle-kit push --force", {
      stdio: "inherit",
      env: process.env,
    });
    console.log("Drizzle schema pushed");

    await ensurePgvectorIntentTable();
    console.log("pgvector + tool_routing ready");

    console.log("Done. Run: npm run seed-intent-utterances");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Setup failed:", message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

setupDevDb();
