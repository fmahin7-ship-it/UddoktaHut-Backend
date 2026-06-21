import { env } from "../../../config/env.js";
import { getToolDefinitions } from "../tools/definitions.js";
import {
  DEFAULT_INTENT_HIGH_CONFIDENCE,
  DEFAULT_INTENT_MEDIUM_MAX_TOOLS,
  DEFAULT_INTENT_MIN_CONFIDENCE,
  INTENT_TIERS,
} from "./constants.js";

/**
 * Tiered intent policy:
 * - AUTO (≥ high): auto-run top tool, LLM streams answer only
 * - HIGH (≥ high, auto disabled): expose only top tool to LLM
 * - MEDIUM (≥ min): expose top 2 matched tools
 * - FULL: no confident match — expose all tools
 */
const applyIntentPolicy = (intentMatches) => {
  const tieredEnabled = env.AI_INTENT_TIERED !== false;

  if (!tieredEnabled || !intentMatches?.length) {
    return {
      tier: INTENT_TIERS.FULL,
      toolNames: null,
      toolsToExpose: getToolDefinitions(),
      autoRunTool: null,
      topConfidence: intentMatches[0]?.similarity ?? null,
    };
  }

  const top = intentMatches[0];
  const highThreshold =
    env.AI_INTENT_HIGH_CONFIDENCE ?? DEFAULT_INTENT_HIGH_CONFIDENCE;
  const mediumThreshold =
    env.AI_INTENT_MIN_CONFIDENCE ?? DEFAULT_INTENT_MIN_CONFIDENCE;
  const mediumMaxTools =
    env.AI_INTENT_MEDIUM_MAX_TOOLS ?? DEFAULT_INTENT_MEDIUM_MAX_TOOLS;

  if (top.similarity >= highThreshold) {
    const toolNames = [top.tool_name];

    if (env.AI_INTENT_AUTO_RUN !== false) {
      return {
        tier: INTENT_TIERS.AUTO,
        toolNames,
        toolsToExpose: getToolDefinitions(toolNames),
        autoRunTool: top.tool_name,
        topConfidence: top.similarity,
      };
    }

    return {
      tier: INTENT_TIERS.HIGH,
      toolNames,
      toolsToExpose: getToolDefinitions(toolNames),
      autoRunTool: null,
      topConfidence: top.similarity,
    };
  }

  if (top.similarity >= mediumThreshold) {
    const toolNames = intentMatches
      .slice(0, mediumMaxTools)
      .map((m) => m.tool_name);

    return {
      tier: INTENT_TIERS.MEDIUM,
      toolNames,
      toolsToExpose: getToolDefinitions(toolNames),
      autoRunTool: null,
      topConfidence: top.similarity,
    };
  }

  return {
    tier: INTENT_TIERS.FULL,
    toolNames: null,
    toolsToExpose: getToolDefinitions(),
    autoRunTool: null,
    topConfidence: top.similarity,
  };
};

export { applyIntentPolicy };
