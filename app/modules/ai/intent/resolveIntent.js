import { env } from "../../../config/env.js";
import { generateEmbedding } from "../provider.js";
import { HANDLERS } from "../tools/registry.js";
import { withSpan } from "../observability/aiTrace.js";
import { rankIntentMatches } from "./rankIntentMatches.js";
import { countIntentUtterances } from "./intentVectorStore.js";

const ALLOWED_TOOLS = new Set(Object.keys(HANDLERS));

const isIntentResolutionEnabled = () => env.AI_INTENT_RESOLUTION !== false;

const filterAllowedMatches = (matches) =>
  matches.filter((match) => ALLOWED_TOOLS.has(match.tool_name));

/**
 * Intent resolution: embed question → pgvector utterance match → tool candidates.
 * Fail-open: returns [] on error or when disabled / index empty.
 */
const resolveIntent = async (question) => {
  if (!isIntentResolutionEnabled()) {
    return [];
  }

  try {
    return await withSpan("intent-resolve", { question }, async () => {
      const utteranceCount = await countIntentUtterances();
      if (utteranceCount === 0) {
        return [];
      }

      const embedding = await generateEmbedding(question.trim());
      const matches = await rankIntentMatches(embedding);
      return filterAllowedMatches(matches);
    });
  } catch (error) {
    console.warn("[AI intent] resolution skipped:", error.message);
    return [];
  }
};

export { resolveIntent, isIntentResolutionEnabled };
