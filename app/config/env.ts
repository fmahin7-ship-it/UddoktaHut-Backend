import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const boolFromEnv = (value: string | undefined, defaultTrue = false) => {
  if (value === undefined) return defaultTrue;
  return value !== "false";
};

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "staging", "production"])
      .default("development"),
    PORT: z.string().optional(),
    JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
    JWT_REFRESH_TOKEN: z.string().min(1, "JWT_REFRESH_TOKEN is required"),
    DB_NAME: z.string().min(1, "DB_NAME is required"),
    DB_USER: z.string().min(1, "DB_USER is required"),
    DB_PASS: z.string(),
    DB_HOST: z.string().default("localhost"),
    DB_PORT: z.string().optional(),
    DB_NAME_TEST: z.string().optional(),
    ZOHO_APP_PASSWORD: z.string().optional(),
    ZOHO_CLIENT_ID: z.string().optional(),
    ZOHO_CLIENT_SECRET: z.string().optional(),
    ZOHO_REFRESH_TOKEN: z.string().optional(),
    ZOHO_ACCOUNT_ID: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    UDDOKTAHUT_EMAIL: z.string().optional(),
    SMTP_PORT: z.string().optional(),
    SMS_API_KEY: z.string().optional(),
    SMS_SENDER_ID: z.string().optional(),
    SMS_TYPE: z.string().optional(),
    SMS_URL: z.string().optional(),
    AI_PROVIDER: z.string().default("openai"),
    OPENAI_API_KEY: z.string().optional(),
    AI_CHAT_MODEL: z.string().default("gpt-4o-mini"),
    AI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
    OLLAMA_URL: z.string().default("http://localhost:11434"),
    OLLAMA_CHAT_MODEL: z.string().default("llama3.1:8b"),
    OLLAMA_EMBEDDING_MODEL: z.string().default("nomic-embed-text"),
    AI_DEV_BYPASS: z.string().optional(),
    AI_DEV_DEFAULT_STORE: z.string().optional(),
    AI_RATE_LIMIT_MAX: z.string().optional(),
    AI_RATE_LIMIT_WINDOW_MS: z.string().optional(),
    LANGFUSE_PUBLIC_KEY: z.string().optional(),
    LANGFUSE_SECRET_KEY: z.string().optional(),
    LANGFUSE_BASE_URL: z.string().optional(),
    LANGFUSE_ENABLED: z.string().optional(),
    AI_USE_TOOLS: z.string().optional(),
    AI_INTENT_RESOLUTION: z.string().optional(),
    AI_USE_VECTOR_ROUTING: z.string().optional(),
    AI_INTENT_TOP_K: z.string().optional(),
    AI_ROUTING_TOP_K: z.string().optional(),
    AI_INTENT_MIN_CONFIDENCE: z.string().optional(),
    AI_ROUTING_SIMILARITY_THRESHOLD: z.string().optional(),
    AI_INTENT_TIERED: z.string().optional(),
    AI_INTENT_HIGH_CONFIDENCE: z.string().optional(),
    AI_INTENT_MEDIUM_MAX_TOOLS: z.string().optional(),
    AI_INTENT_AUTO_RUN: z.string().optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_PRICE_PRO: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    APP_PUBLIC_URL: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production") {
      if (!data.STRIPE_SECRET_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["STRIPE_SECRET_KEY"],
          message: "STRIPE_SECRET_KEY is required in production",
        });
      }
      if (!data.STRIPE_WEBHOOK_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["STRIPE_WEBHOOK_SECRET"],
          message: "STRIPE_WEBHOOK_SECRET is required in production",
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("\n");
  console.error("❌ Invalid environment configuration:\n" + details);
  process.exit(1);
}

const raw = parsed.data;
const isProd = raw.NODE_ENV === "production";
const isDev = raw.NODE_ENV === "development";
const isTest = raw.NODE_ENV === "test";
const isStaging = raw.NODE_ENV === "staging";

/** Prefer DB_NAME_TEST when NODE_ENV=test or USE_TEST_DB=true. */
const resolvedDbName =
  (isTest || process.env.USE_TEST_DB === "true") && raw.DB_NAME_TEST
    ? raw.DB_NAME_TEST
    : raw.DB_NAME;

export const env = {
  PORT: raw.PORT,
  ZOHO_APP_PASSWORD: raw.ZOHO_APP_PASSWORD,
  ZOHO_CLIENT_ID: raw.ZOHO_CLIENT_ID,
  ZOHO_CLIENT_SECRET: raw.ZOHO_CLIENT_SECRET,
  ZOHO_REFRESH_TOKEN: raw.ZOHO_REFRESH_TOKEN,
  ZOHO_ACCOUNT_ID: raw.ZOHO_ACCOUNT_ID,
  SMTP_HOST: raw.SMTP_HOST,
  UDDOKTAHUT_EMAIL: raw.UDDOKTAHUT_EMAIL,
  SMTP_PORT: raw.SMTP_PORT,
  JWT_SECRET: raw.JWT_SECRET,
  JWT_REFRESH_TOKEN: raw.JWT_REFRESH_TOKEN,
  SMS_API_KEY: raw.SMS_API_KEY,
  SMS_SENDER_ID: raw.SMS_SENDER_ID,
  SMS_TYPE: raw.SMS_TYPE,
  SMS_URL: raw.SMS_URL,
  NODE_ENV: raw.NODE_ENV,
  DB_NAME: resolvedDbName,
  DB_NAME_TEST: raw.DB_NAME_TEST,
  DB_USER: raw.DB_USER,
  DB_PASS: raw.DB_PASS,
  DB_HOST: raw.DB_HOST,
  DB_PORT: raw.DB_PORT,
  AI_PROVIDER: raw.AI_PROVIDER.toLowerCase(),
  OPENAI_API_KEY: raw.OPENAI_API_KEY,
  AI_CHAT_MODEL: raw.AI_CHAT_MODEL,
  AI_EMBEDDING_MODEL: raw.AI_EMBEDDING_MODEL,
  OLLAMA_URL: raw.OLLAMA_URL,
  OLLAMA_CHAT_MODEL: raw.OLLAMA_CHAT_MODEL,
  OLLAMA_EMBEDDING_MODEL: raw.OLLAMA_EMBEDDING_MODEL,
  AI_DEV_BYPASS: !isProd && raw.AI_DEV_BYPASS === "true",
  AI_DEV_DEFAULT_STORE: raw.AI_DEV_DEFAULT_STORE || "",
  AI_RATE_LIMIT_MAX: parseInt(raw.AI_RATE_LIMIT_MAX || "10", 10),
  AI_RATE_LIMIT_WINDOW_MS: parseInt(raw.AI_RATE_LIMIT_WINDOW_MS || "60000", 10),
  LANGFUSE_PUBLIC_KEY: raw.LANGFUSE_PUBLIC_KEY || "",
  LANGFUSE_SECRET_KEY: raw.LANGFUSE_SECRET_KEY || "",
  LANGFUSE_BASE_URL: raw.LANGFUSE_BASE_URL || "https://jp.cloud.langfuse.com",
  LANGFUSE_ENABLED: raw.LANGFUSE_ENABLED === "true",
  AI_USE_TOOLS: boolFromEnv(raw.AI_USE_TOOLS, true),
  AI_INTENT_RESOLUTION:
    boolFromEnv(raw.AI_INTENT_RESOLUTION, true) &&
    boolFromEnv(raw.AI_USE_VECTOR_ROUTING, true),
  AI_INTENT_TOP_K: parseInt(raw.AI_INTENT_TOP_K || raw.AI_ROUTING_TOP_K || "3", 10),
  AI_INTENT_MIN_CONFIDENCE: parseFloat(
    raw.AI_INTENT_MIN_CONFIDENCE || raw.AI_ROUTING_SIMILARITY_THRESHOLD || "0.72"
  ),
  AI_INTENT_TIERED: boolFromEnv(raw.AI_INTENT_TIERED, true),
  AI_INTENT_HIGH_CONFIDENCE: parseFloat(raw.AI_INTENT_HIGH_CONFIDENCE || "0.85"),
  AI_INTENT_MEDIUM_MAX_TOOLS: parseInt(
    raw.AI_INTENT_MEDIUM_MAX_TOOLS || "2",
    10
  ),
  AI_INTENT_AUTO_RUN: boolFromEnv(raw.AI_INTENT_AUTO_RUN, true),
  STRIPE_SECRET_KEY: raw.STRIPE_SECRET_KEY || "",
  STRIPE_PRICE_PRO: raw.STRIPE_PRICE_PRO || "",
  STRIPE_WEBHOOK_SECRET: raw.STRIPE_WEBHOOK_SECRET || "",
  APP_PUBLIC_URL:
    raw.APP_PUBLIC_URL ||
    (isProd ? "https://uddoktahut.com" : "http://uddoktahut.local:3000"),
  isProd,
  isDev,
  isTest,
  isStaging,
} as const;

export type Env = typeof env;
