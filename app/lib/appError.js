const createAppError = (message, statusCode, code, details = undefined) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (code) err.code = code;
  if (details !== undefined) err.details = details;
  return err;
};

const throwAppError = (message, statusCode, code, details) => {
  throw createAppError(message, statusCode, code, details);
};

export { createAppError, throwAppError };
