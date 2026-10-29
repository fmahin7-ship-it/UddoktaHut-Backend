import { isIntentResolutionEnabled } from "./resolveIntent.ts";
import { countIntentUtterances } from "./intentVectorStore.ts";

const checkIntentResolutionHealth = async () => {
  if (!isIntentResolutionEnabled()) {
    return { available: false, reason: "disabled" };
  }

  try {
    const utteranceCount = await countIntentUtterances();
    return {
      available: utteranceCount > 0,
      utteranceCount,
      reason:
        utteranceCount > 0
          ? null
          : "intent index empty — run npm run seed-intent-utterances",
    };
  } catch (error: unknown) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
};

export { checkIntentResolutionHealth };
