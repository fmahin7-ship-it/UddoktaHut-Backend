import { Langfuse } from "langfuse";
import { env } from "../../../config/env.js";

let client = null;

const stripQuotes = (value) =>
  typeof value === "string" ? value.replace(/^["']|["']$/g, "") : "";

const isLangfuseEnabled = () =>
  env.LANGFUSE_ENABLED === true &&
  Boolean(env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY && env.LANGFUSE_BASE_URL);

const getLangfuseAuthHeader = () => {
  const publicKey = stripQuotes(env.LANGFUSE_PUBLIC_KEY);
  const secretKey = stripQuotes(env.LANGFUSE_SECRET_KEY);
  return `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString("base64")}`;
};

const getLangfuseClient = () => {
  if (!isLangfuseEnabled()) {
    return null;
  }

  if (!client) {
    client = new Langfuse({
      publicKey: stripQuotes(env.LANGFUSE_PUBLIC_KEY),
      secretKey: stripQuotes(env.LANGFUSE_SECRET_KEY),
      baseUrl: stripQuotes(env.LANGFUSE_BASE_URL),
      // Dev: push each event immediately instead of waiting for batch (default ~10s / 15 events).
      ...(env.isDev ? { flushAt: 1, flushInterval: 1 } : {}),
    });
  }

  return client;
};

const flushLangfuse = async (label = "") => {
  if (!isLangfuseEnabled()) {
    return false;
  }

  try {
    await getLangfuseClient().flushAsync();
    if (env.isDev && label) {
      console.log(`[Langfuse] flushed (${label})`);
    }
    return true;
  } catch (error) {
    console.error("[Langfuse] flush failed:", error.message);
    return false;
  }
};

const fetchRecentTraceCount = async () => {
  if (!isLangfuseEnabled()) {
    return null;
  }

  try {
    const baseUrl = stripQuotes(env.LANGFUSE_BASE_URL);
    const auth = getLangfuseAuthHeader();

    const res = await fetch(`${baseUrl}/api/public/traces?limit=1`, {
      headers: { Authorization: auth },
    });

    if (!res.ok) {
      return { error: `HTTP ${res.status}` };
    }

    const json = await res.json();
    return {
      totalTraces: json.meta?.totalItems ?? 0,
      latestTrace: json.data?.[0]
        ? {
            name: json.data[0].name,
            sessionId: json.data[0].sessionId,
            timestamp: json.data[0].timestamp,
          }
        : null,
    };
  } catch (error) {
    return { error: error.message };
  }
};

const shutdownLangfuse = async () => {
  if (!client) {
    return;
  }

  try {
    await client.shutdownAsync();
  } catch (error) {
    console.error("[Langfuse] shutdown failed:", error.message);
  } finally {
    client = null;
  }
};

export {
  isLangfuseEnabled,
  getLangfuseClient,
  flushLangfuse,
  fetchRecentTraceCount,
  shutdownLangfuse,
};
