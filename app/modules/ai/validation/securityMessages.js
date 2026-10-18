const getSecurityErrorMessage = (error, storeName) => {
  const message = error.message?.toLowerCase() || "";

  if (message.includes("query must include the specific store name")) {
    return `I couldn't run that question safely for your store (${storeName}). Try asking about products, stock, or categories in your store.`;
  }

  if (
    message.includes("security violation") ||
    message.includes("forbidden sql")
  ) {
    return `I can only access data for your store (${storeName}). I can't show information from other stores or run unsafe queries.`;
  }

  return error.message;
};

export { getSecurityErrorMessage };
