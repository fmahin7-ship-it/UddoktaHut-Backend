import { allowedContexts, blockedContexts } from "../../../utils/constant.js";

/**
 * Authenticated store copilot: block-list only (security).
 * Allow-list keywords skipped when storeName is present — intent + tools handle routing.
 */
const validateBusinessContext = (question, { storeName } = {}) => {
  const lowerQuestion = question.toLowerCase();

  for (const blocked of blockedContexts) {
    if (lowerQuestion.includes(blocked)) {
      return {
        isValid: false,
        errorType: "security",
        message: `I can't help with that request as it contains restricted content. Please ask questions about your business, store, products, or account information instead.`,
      };
    }
  }

  if (storeName?.trim()) {
    return { isValid: true };
  }

  // If no store context, require at least one allowed keyword to ensure relevance.
  const hasAllowedContext = allowedContexts.some((context) =>
    lowerQuestion.includes(context)
  );

  if (!hasAllowedContext) {
    return {
      isValid: false,
      errorType: "context",
      message: `I can only help with questions related to your business, store, products, or account information. Please ask something about your store operations, inventory, or business analytics.`,
    };
  }

  return { isValid: true };
};

export { validateBusinessContext };
