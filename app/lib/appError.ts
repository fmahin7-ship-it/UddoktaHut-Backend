export type AppErrorShape = Error & {
  statusCode: number;
  code?: string;
  details?: unknown;
};

const createAppError = (
  message: string,
  statusCode: number,
  code?: string,
  details?: unknown
): AppErrorShape => {
  const err = new Error(message) as AppErrorShape;
  err.statusCode = statusCode;
  if (code) err.code = code;
  if (details !== undefined) err.details = details;
  return err;
};

const throwAppError = (
  message: string,
  statusCode: number,
  code?: string,
  details?: unknown
): never => {
  throw createAppError(message, statusCode, code, details);
};

export { createAppError, throwAppError };
