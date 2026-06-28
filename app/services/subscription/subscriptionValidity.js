import { SUBSCRIPTION_ERROR_CODES } from "../../constants/plans.js";
import { createAppError } from "../../lib/appError.js";

const isSubscriptionActive = (subscription, now = new Date()) => {
  if (!subscription) return false;

  if (subscription.status === "trialing") {
    return (
      subscription.trial_ends_at &&
      new Date(subscription.trial_ends_at) > now
    );
  }

  if (subscription.status === "active") {
    return subscription.end_date && new Date(subscription.end_date) > now;
  }

  return false;
};

const buildInactiveSubscriptionError = (subscription, isPublicRoute = false) => {
  if (!subscription) {
    return createAppError(
      isPublicRoute
        ? "Store subscription not found."
        : "No subscription found. Please subscribe to continue.",
      isPublicRoute ? 403 : 403,
      SUBSCRIPTION_ERROR_CODES.SUBSCRIPTION_REQUIRED
    );
  }

  const isTrialing = subscription.status === "trialing";

  return createAppError(
    isPublicRoute
      ? "Store is temporarily unavailable."
      : isTrialing
        ? "Free trial expired. Please subscribe to continue."
        : "Subscription expired. Please renew to continue.",
    403,
    isTrialing
      ? SUBSCRIPTION_ERROR_CODES.TRIAL_EXPIRED
      : SUBSCRIPTION_ERROR_CODES.SUBSCRIPTION_EXPIRED
  );
};

export { isSubscriptionActive, buildInactiveSubscriptionError };
