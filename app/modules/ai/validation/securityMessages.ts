const getSecurityErrorMessage = (error: unknown, storeName: string): string => {
  const message = error instanceof Error ? error.message : String(error);
  return `I can only help with store "${storeName}" data. ${message}`;
};

export { getSecurityErrorMessage };
