import { env } from "./env.ts";

export type DatabaseConfig = {
  username: string;
  password: string;
  database: string;
  host: string;
  port: number;
  ssl: false | { rejectUnauthorized: false };
};

const buildDatabaseConfig = (
  nodeEnv: string = env.NODE_ENV || "development"
): DatabaseConfig => {
  const isProduction = nodeEnv === "production";
  const forceSsl =
    process.env.DB_SSL === "true" ||
    process.env.DB_SSL === "1" ||
    isProduction;

  return {
    username: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
    host: env.DB_HOST,
    port: Number(env.DB_PORT) || 5432,
    // Managed hosts (Render, Neon, etc.) need SSL even for one-off scripts.
    ssl: forceSsl ? { rejectUnauthorized: false } : false,
  };
};

export { buildDatabaseConfig };
