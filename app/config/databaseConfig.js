import { env } from "./env.js";

const buildDatabaseConfig = (nodeEnv = env.NODE_ENV || "development") => {
  const isProduction = nodeEnv === "production";

  return {
    username: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
    host: env.DB_HOST,
    port: Number(env.DB_PORT) || 5432,
    dialect: "postgres",
    logging: false,
    dialectOptions: isProduction
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : { ssl: false },
  };
};

export { buildDatabaseConfig };
