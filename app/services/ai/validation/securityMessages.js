const getSecurityErrorMessage = (error, storeName) => {
  const message = error.message?.toLowerCase() || "";

  if (
    message.includes("store name") ||
    message.includes("security") ||
    message.includes("forbidden")
  ) {
    return `I can only access data for your store (${storeName}). I can't show information from other stores or run unsafe queries.`;
  }

  return error.message;
};

export { getSecurityErrorMessage };
