import { env } from "../../../config/env.ts";
import { withSpan } from "../observability/aiTrace.ts";
import { generateEmbedding } from "../provider.ts";
import { HANDLERS } from "../tools/registry.ts";
import { countIntentUtterances } from "./intentVectorStore.ts";
import { rankIntentMatches } from "./rankIntentMatches.ts";

type IntentMatch = {
  tool_name: string;
  similarity: number;
  matched_utterance?: string;
};

const ALLOWED_TOOLS = new Set(Object.keys(HANDLERS));

const isIntentResolutionEnabled = () => env.AI_INTENT_RESOLUTION !== false;

const filterAllowedMatches = (matches: IntentMatch[]): IntentMatch[] =>
  matches.filter((match) => ALLOWED_TOOLS.has(match.tool_name));

/**
 * Intent resolution: embed question → pgvector utterance match → tool candidates.
 * Fail-open: returns [] on error or when disabled / index empty.
 */
const resolveIntent = async (question: string): Promise<IntentMatch[]> => {
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
      const matches = (await rankIntentMatches(embedding)) as IntentMatch[];
      return filterAllowedMatches(matches);
    });
  } catch (error: unknown) {
    console.warn(
      "[AI intent] resolution skipped:",
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
};

export { resolveIntent, isIntentResolutionEnabled };
