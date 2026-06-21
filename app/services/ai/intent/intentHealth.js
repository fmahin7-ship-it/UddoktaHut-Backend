import { isIntentResolutionEnabled } from "./resolveIntent.js";
import { countIntentUtterances } from "./intentVectorStore.js";

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
  } catch (error) {
    return {
      available: false,
      reason: error.message,
    };
  }
};

export { checkIntentResolutionHealth };
