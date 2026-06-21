import { env } from "../../../config/env.js";
import {
  DEFAULT_INTENT_MIN_CONFIDENCE,
  DEFAULT_INTENT_TOP_K,
} from "./constants.js";
import { findSimilarUtterances } from "./intentVectorStore.js";

/**
 * Dedupe by tool_name, keep highest similarity per tool.
 */
const dedupeByTool = (rows) => {
  const best = new Map();

  for (const row of rows) {
    const existing = best.get(row.tool_name);
    if (!existing || row.similarity > existing.similarity) {
      best.set(row.tool_name, row);
    }
  }

  return [...best.values()].sort((a, b) => b.similarity - a.similarity);
};

const rankIntentMatches = async (embedding, options = {}) => {
  const limit = options.limit ?? env.AI_INTENT_TOP_K ?? DEFAULT_INTENT_TOP_K;
  const threshold =
    options.threshold ??
    env.AI_INTENT_MIN_CONFIDENCE ??
    DEFAULT_INTENT_MIN_CONFIDENCE;

  const rows = await findSimilarUtterances(embedding, { limit, threshold });
  return dedupeByTool(rows).map((row) => ({
    tool_name: row.tool_name,
    similarity: Number(row.similarity),
    matched_utterance: row.example_question,
  }));
};

export { rankIntentMatches };
