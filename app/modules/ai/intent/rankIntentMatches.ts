import { env } from "../../../config/env.ts";
import {
  DEFAULT_INTENT_MIN_CONFIDENCE,
  DEFAULT_INTENT_TOP_K,
} from "./constants.ts";
import { findSimilarUtterances } from "./intentVectorStore.ts";

/**
 * Dedupe by tool_name, keep highest similarity per tool.
 */
type UtteranceRow = {
  tool_name: string;
  similarity: number;
  example_question?: string;
};

const dedupeByTool = (rows: UtteranceRow[]) => {
  const best = new Map<string, UtteranceRow>();

  for (const row of rows) {
    const existing = best.get(row.tool_name);
    if (!existing || row.similarity > existing.similarity) {
      best.set(row.tool_name, row);
    }
  }

  return [...best.values()].sort((a, b) => b.similarity - a.similarity);
};

const rankIntentMatches = async (
  embedding: number[],
  options: { limit?: number; threshold?: number } = {}
) => {
  const limit = options.limit ?? env.AI_INTENT_TOP_K ?? DEFAULT_INTENT_TOP_K;
  const threshold =
    options.threshold ??
    env.AI_INTENT_MIN_CONFIDENCE ??
    DEFAULT_INTENT_MIN_CONFIDENCE;

  const rows = (await findSimilarUtterances(embedding, {
    limit,
    threshold,
  })) as UtteranceRow[];
  return dedupeByTool(rows).map((row) => ({
    tool_name: row.tool_name,
    similarity: Number(row.similarity),
    matched_utterance: row.example_question,
  }));
};

export { rankIntentMatches };
