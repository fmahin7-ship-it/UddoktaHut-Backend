import type { AppErrorShape } from "./appError.ts";

const throwError = (message: string, status: number): never => {
  const err = new Error(message) as AppErrorShape;
  err.statusCode = status;
  throw err;
};

/** Narrows nullish values; throws AppErrorShape via throwError. */
function assertFound<T>(
  value: T | null | undefined,
  message: string,
  status = 404
): asserts value is T {
  if (value === null || value === undefined) {
    throwError(message, status);
  }
}

export { throwError, assertFound };
