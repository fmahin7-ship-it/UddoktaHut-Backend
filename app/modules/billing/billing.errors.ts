import { createAppError } from "../../lib/appError.ts";

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

export {
  PermanentBillingError,
  isPermanentBillingError,
  isStripeSdkError,
  stripeNotConfiguredError,
};
export type { PermanentLikeError, StripeLikeError };
