import { getSecurityErrorMessage } from "../validation/securityMessages.ts";
import { createErrorStream } from "./errorStream.ts";

type ValidationResult = {
  isValid?: boolean;
  message?: string;
  errorType?: string | null;
};

const buildValidationErrorResponse = (
  validation: ValidationResult,
  extraMetadata: Record<string, unknown> = {}
) => ({
  stream: { body: createErrorStream(validation.message ?? "Invalid request") },
  metadata: {
    intent: "error",
    sqlQuery: null,
    errorType: validation.errorType,
    ...extraMetadata,
  },
});

const buildSecurityErrorResponse = (
  error: unknown,
  storeName: string,
  extraMetadata: Record<string, unknown> = {}
) => ({
  stream: {
    body: createErrorStream(getSecurityErrorMessage(error, storeName)),
  },
  metadata: {
    intent: "error",
    sqlQuery: null,
    errorType: "security",
    ...extraMetadata,
  },
});

export { buildValidationErrorResponse, buildSecurityErrorResponse };
