import { allowedContexts, blockedContexts } from "../../../utils/constant.js";

const validateBusinessContext = (question) => {
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
