/**
 * Full Langfuse diagnostic — run: node scripts/langfuse-diagnose.mjs
 */
import dotenv from "dotenv";
dotenv.config();

import jwt from "jsonwebtoken";
import { Langfuse } from "langfuse";
import { runWithAITrace } from "../app/modules/ai/observability/aiTrace.js";
import { processAIQueryStream } from "../app/modules/ai/aiService.js";
import { isLangfuseEnabled, flushLangfuse } from "../app/modules/ai/observability/langfuseClient.js";

const baseUrl = process.env.LANGFUSE_BASE_URL;
const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
const secretKey = process.env.LANGFUSE_SECRET_KEY;

console.log("\n=== 1. CONFIG ===");
console.log({ enabled: isLangfuseEnabled(), baseUrl, publicKey: publicKey?.slice(0, 12) + "..." });

console.log("\n=== 2. DIRECT INGEST (REST) ===");
const traceId = `diag-${Date.now()}`;
const batch = {
  batch: [
    {
      id: crypto.randomUUID(),
      type: "trace-create",
      timestamp: new Date().toISOString(),
      body: {
        id: traceId,
        name: "diag-rest-trace",
        input: { test: true },
      },
    },
  ],
  metadata: { sdk: "diagnose-script" },
};

const ingestRes = await fetch(`${baseUrl}/api/public/ingestion`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString("base64")}`,
  },
  body: JSON.stringify(batch),
});
const ingestBody = await ingestRes.text();
console.log("ingestion HTTP:", ingestRes.status, ingestBody.slice(0, 300));

console.log("\n=== 3. SDK TRACE + DEBUG ===");
const lf = new Langfuse({ publicKey, secretKey, baseUrl });
lf.debug(true);
const sdkTraceId = `diag-sdk-${Date.now()}`;
lf.trace({ id: sdkTraceId, name: "diag-sdk-trace", input: { q: "test" } }).update({
  output: { ok: true },
});
await lf.flushAsync();
console.log("sdk trace id:", sdkTraceId);

console.log("\n=== 4. FULL AI PIPELINE (runWithAITrace) ===");
let captured = "";
await runWithAITrace(
  {
    question: "How many products?",
    storeName: "stop-and-shop",
    userId: 1,
    provider: "openai",
    useRAG: true,
  },
  async () => {
    const result = await processAIQueryStream("How many products?", "stop-and-shop");
    const reader = result.stream.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      captured += decoder.decode(value);
    }
    if (result.stream.completed) await result.stream.completed;
    return { metadata: result.metadata, answerPreview: captured.slice(0, 100) };
  }
);
console.log("pipeline answer snippet:", captured.slice(0, 80));

console.log("\n=== 5. LIVE BACKEND (if running) ===");
try {
  const token = jwt.sign(
    { id: 1, onboarded: true, roles: [1], storeName: "stop-and-shop" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
  const res = await fetch("http://localhost:4000/ai/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-store-name": "stop-and-shop",
    },
    body: JSON.stringify({ question: "How many products?" }),
  });
  console.log("backend HTTP:", res.status, (await res.text()).slice(0, 60));
} catch (e) {
  console.log("backend unreachable:", e.message);
}

await flushLangfuse();
console.log("\n=== DONE ===");
console.log("Search Langfuse for trace IDs:");
console.log(" -", traceId);
console.log(" -", sdkTraceId);
console.log(" - ai-query (name filter)");
console.log("Dashboard:", baseUrl);
