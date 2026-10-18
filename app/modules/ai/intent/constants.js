/** Must match OpenAI text-embedding-3-small dimensions. */
const EMBEDDING_DIMENSIONS = 1536;

const DEFAULT_INTENT_TOP_K = 3;
const DEFAULT_INTENT_MIN_CONFIDENCE = 0.72;
const DEFAULT_INTENT_HIGH_CONFIDENCE = 0.85;
const DEFAULT_INTENT_MEDIUM_MAX_TOOLS = 2;

const INTENT_TIERS = {
  FULL: "full",
  MEDIUM: "medium",
  HIGH: "high",
  AUTO: "auto",
};

const formatVectorLiteral = (embedding) => {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("Embedding must be a non-empty array");
  }
  return `[${embedding.join(",")}]`;
};

export {
  EMBEDDING_DIMENSIONS,
  DEFAULT_INTENT_TOP_K,
  DEFAULT_INTENT_MIN_CONFIDENCE,
  DEFAULT_INTENT_HIGH_CONFIDENCE,
  DEFAULT_INTENT_MEDIUM_MAX_TOOLS,
  INTENT_TIERS,
  formatVectorLiteral,
};
