import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./app/config/env.ts";
import { rootRoute } from "./app/routes/rootRoute.ts";
import { errorHandler } from "./app/middleware/errorHandler.ts";
import { syncDatabaseOnBoot } from "./app/db/bootstrap.ts";
import { pool } from "./app/db/client.ts";
import { stripeWebhook } from "./app/modules/billing/billing.controller.ts";
import { shutdownLangfuse } from "./app/modules/ai/observability/langfuseClient.ts";

const app = express();
const port = env.PORT || 4000;

app.set("trust proxy", env.isProd ? 1 : false);
app.use(helmet());

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ ok: true, db: true });
  } catch {
    res.status(503).json({ ok: false, db: false });
  }
});

app.post(
  "/subscription/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

app.use(express.json());
app.use(
  cors(
    !env.isProd
      ? {
          origin: "http://uddoktahut.local:3000",
          credentials: true,
        }
      : {
          origin: "https://uddoktahut.com",
          credentials: true,
        }
  )
);
app.use(cookieParser());

rootRoute(app);

app.use(errorHandler);

let server: ReturnType<typeof app.listen> | undefined;

const shutdown = async (signal: string) => {
  console.log(`\n${signal} received — shutting down`);
  try {
    await new Promise<void>((resolve, reject) => {
      if (!server) {
        resolve();
        return;
      }
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await shutdownLangfuse();
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("Shutdown error:", err);
    process.exit(1);
  }
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

(async () => {
  try {
    await syncDatabaseOnBoot();
    server = app.listen(port, () => {
      console.log(`🚀 Server running at http://localhost:${port}`);
    });
  } catch (err) {
    console.error("❌ Database connection failed:", err);
    process.exit(1);
  }
})();
