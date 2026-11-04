import { createAppError } from "../../lib/appError.ts";
import { SUBSCRIPTION_ERROR_CODES } from "../../constants/plans.ts";

/** Permanent webhook/checkout failure — mark the event done, do not retry. */
class PermanentBillingError extends Error {
  permanent = true;
  constructor(message: string) {
    super(message);
  }
}

type PermanentLikeError = Error & { permanent?: boolean };

type StripeLikeError = {
  type?: string;
  code?: string;
  message?: string;
};

const isPermanentBillingError = (err: unknown): err is PermanentLikeError =>
  Boolean(err && typeof err === "object" && (err as PermanentLikeError).permanent);

const isStripeSdkError = (err: unknown): err is StripeLikeError =>
  Boolean(
    err &&
      typeof err === "object" &&
      typeof (err as StripeLikeError).type === "string" &&
      (err as StripeLikeError).type!.startsWith("Stripe")
  );

const stripeNotConfiguredError = () =>
  createAppError(
    "Card checkout is not configured.",
    500,
    "STRIPE_NOT_CONFIGURED"
  );

const subscriptionRequiredError = () =>
  createAppError(
    "No subscription found. Please subscribe to continue.",
    403,
    SUBSCRIPTION_ERROR_CODES.SUBSCRIPTION_REQUIRED
  );

const cardDeclinedError = () =>
  createAppError(
    "Your card was declined. You are still on your current plan.",
    402,
    "CARD_DECLINED"
  );

/** Log a Stripe SDK failure and throw a stable API error. */
const rethrowAsBillingError = (
  err: unknown,
  logLabel: string,
  userMessage: string,
  code: string,
  statusCode = 502
): never => {
  if (!isStripeSdkError(err)) throw err;
  console.error(logLabel, err.type, err.code, err.message);
  throw createAppError(userMessage, statusCode, code);
};

export {
  PermanentBillingError,
  cardDeclinedError,
  isPermanentBillingError,
  isStripeSdkError,
  rethrowAsBillingError,
  stripeNotConfiguredError,
  subscriptionRequiredError,
};
export type { PermanentLikeError, StripeLikeError };
