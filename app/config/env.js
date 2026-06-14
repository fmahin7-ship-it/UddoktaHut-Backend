import dotenv from "dotenv";
dotenv.config();
export const env = {
  PORT: process.env.PORT,
  ZOHO_APP_PASSWORD: process.env.ZOHO_APP_PASSWORD,
  ZOHO_CLIENT_ID: process.env.ZOHO_CLIENT_ID,
  ZOHO_CLIENT_SECRET: process.env.ZOHO_CLIENT_SECRET,
  ZOHO_REFRESH_TOKEN: process.env.ZOHO_REFRESH_TOKEN,
  ZOHO_ACCOUNT_ID: process.env.ZOHO_ACCOUNT_ID,
  SMTP_HOST: process.env.SMTP_HOST,
  UDDOKTAHUT_EMAIL: process.env.UDDOKTAHUT_EMAIL,
  SMTP_PORT: process.env.SMTP_PORT,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_TOKEN: process.env.JWT_REFRESH_TOKEN,
  SMS_API_KEY: process.env.SMS_API_KEY,
  SMS_SENDER_ID: process.env.SMS_SENDER_ID,
  SMS_TYPE: process.env.SMS_TYPE,
  SMS_URL: process.env.SMS_URL,
  NODE_ENV: process.env.NODE_ENV,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_PASS: process.env.DB_PASS,
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  // AI Configuration
  AI_PROVIDER: (process.env.AI_PROVIDER || "openai").toLowerCase(),
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  AI_CHAT_MODEL: process.env.AI_CHAT_MODEL || "gpt-4o-mini",
  AI_EMBEDDING_MODEL:
    process.env.AI_EMBEDDING_MODEL || "text-embedding-3-small",
  OLLAMA_URL: process.env.OLLAMA_URL || "http://localhost:11434",
  OLLAMA_CHAT_MODEL: process.env.OLLAMA_CHAT_MODEL || "llama3.1:8b",
  OLLAMA_EMBEDDING_MODEL:
    process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text",
  AI_DEV_BYPASS:
    process.env.NODE_ENV !== "production" &&
    process.env.AI_DEV_BYPASS === "true",
  AI_DEV_DEFAULT_STORE: process.env.AI_DEV_DEFAULT_STORE || "",
  AI_RATE_LIMIT_MAX: parseInt(process.env.AI_RATE_LIMIT_MAX || "10", 10),
  AI_RATE_LIMIT_WINDOW_MS: parseInt(
    process.env.AI_RATE_LIMIT_WINDOW_MS || "60000",
    10
  ),
  LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY || "",
  LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY || "",
  LANGFUSE_BASE_URL:
    process.env.LANGFUSE_BASE_URL || "https://jp.cloud.langfuse.com",
  LANGFUSE_ENABLED: process.env.LANGFUSE_ENABLED === "true",
  isProd: process.env.NODE_ENV === "production",
  isDev: process.env.NODE_ENV === "development",
};
