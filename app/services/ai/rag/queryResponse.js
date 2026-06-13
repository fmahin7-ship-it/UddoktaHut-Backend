import { createErrorStream } from "../streams/errorStream.js";
import { getSecurityErrorMessage } from "../validation/securityMessages.js";

const buildValidationErrorResponse = (validation, extraMetadata = {}) => ({
  stream: { body: createErrorStream(validation.message) },
  metadata: {
    intent: "error",
    sqlQuery: null,
    errorType: validation.errorType,
    ...extraMetadata,
  },
});

const buildSecurityErrorResponse = (error, storeName, extraMetadata = {}) => ({
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
