import dotenv from "dotenv";
dotenv.config();
import jwt from "jsonwebtoken";
import { Langfuse } from "langfuse";
import { isLangfuseEnabled, flushLangfuse } from "../app/modules/ai/observability/langfuseClient.js";

console.log("enabled:", isLangfuseEnabled());

const lf = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL,
});
const id = `script-test-${Date.now()}`;
lf.trace({ id, name: "script-test", input: { ok: 1 } }).update({ output: { ok: 1 } });
await lf.flushAsync();
console.log("direct trace sent:", id);

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
console.log("ai status:", res.status, (await res.text()).slice(0, 60));
await flushLangfuse();
console.log("flush done");
