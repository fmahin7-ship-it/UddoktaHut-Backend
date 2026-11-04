import type Stripe from "stripe";
import { env } from "../../config/env.ts";
import { createAppError } from "../../lib/appError.ts";
import type { AuthUser } from "../../types/express.d.ts";
import { loadOwnerStoreContext } from "../subscriptions/ownerContext.ts";
import {
  cardDeclinedError,
  rethrowAsBillingError,
  stripeNotConfiguredError,
  subscriptionRequiredError,
} from "./billing.errors.ts";
import {
  isAuCardPlanSlug,
  planRank,
  priceIdForPlan,
} from "./billing.prices.ts";
import {
  applyPlanImmediately,
  clearPendingPlanChange,
  findPlanBySlug,
  setPendingPlanChange,
} from "./billing.repository.ts";
import { getStripe } from "./providers/stripe.ts";
import {
  stripeId,
  subscriptionPeriodEnd,
  subscriptionPriceId,
} from "./providers/stripe-mappers.ts";

const requireActiveStripeSubscription = (subscription: {
  billing_provider: string | null;
  stripe_subscription_id: string | null;
  status: string | null;
}) => {
  if (
    subscription.billing_provider !== "stripe" ||
    !subscription.stripe_subscription_id ||
    (subscription.status !== "active" && subscription.status !== "past_due")
  ) {
    throw createAppError(
      "Start a card subscription with checkout before changing plans.",
      400,
      "NO_STRIPE_SUBSCRIPTION"
    );
  }
  return subscription.stripe_subscription_id;
};

const primaryItemId = (sub: Stripe.Subscription): string => {
  const item = sub.items?.data?.[0];
  if (!item?.id) {
    throw createAppError(
      "Stripe subscription has no price item to update.",
      502,
      "PLAN_CHANGE_FAILED"
    );
  }
  return item.id;
};

const assertUpgradePaid = (
  updated: Stripe.Subscription,
  targetPriceId: string
) => {
  const paid =
    !updated.pending_update &&
    (updated.status === "active" || updated.status === "trialing") &&
    subscriptionPriceId(updated) === targetPriceId;
  if (!paid) throw cardDeclinedError();
};

const upgradeNow = async ({
  stripeSubscriptionId,
  targetPriceId,
  targetPlanId,
  targetSlug,
}: {
  stripeSubscriptionId: string;
  targetPriceId: string;
  targetPlanId: number;
  targetSlug: string;
}) => {
  const stripe = getStripe();
  const current = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const updated = await stripe.subscriptions.update(stripeSubscriptionId, {
    items: [{ id: primaryItemId(current), price: targetPriceId }],
    proration_behavior: "always_invoice",
    payment_behavior: "pending_if_incomplete",
    metadata: {
      ...current.metadata,
      plan_slug: targetSlug,
    },
  });

  assertUpgradePaid(updated, targetPriceId);

  await applyPlanImmediately({
    stripeSubscriptionId,
    planId: targetPlanId,
    periodEnd: subscriptionPeriodEnd(updated),
    status: updated.status,
  });

  return {
    ok: true as const,
    mode: "upgraded" as const,
    planSlug: targetSlug,
    changeAt: null as string | null,
  };
};

const scheduleDowngradeAtPeriodEnd = async ({
  stripeSubscriptionId,
  targetPriceId,
  targetPlanId,
  targetSlug,
}: {
  stripeSubscriptionId: string;
  targetPriceId: string;
  targetPlanId: number;
  targetSlug: string;
}) => {
  const stripe = getStripe();
  const current = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const periodEnd = subscriptionPeriodEnd(current);
  if (!periodEnd) {
    throw createAppError(
      "Stripe subscription has no period end.",
      502,
      "PLAN_CHANGE_FAILED"
    );
  }
  const periodEndUnix = Math.floor(periodEnd.getTime() / 1000);

  const currentPriceId = subscriptionPriceId(current);
  if (!currentPriceId) {
    throw createAppError(
      "Stripe subscription has no current price.",
      502,
      "PLAN_CHANGE_FAILED"
    );
  }

  const existingScheduleId = stripeId(current.schedule);
  let schedule: Stripe.SubscriptionSchedule;
  if (existingScheduleId) {
    schedule = await stripe.subscriptionSchedules.retrieve(existingScheduleId);
  } else {
    schedule = await stripe.subscriptionSchedules.create({
      from_subscription: stripeSubscriptionId,
    });
  }

  const phaseStart = schedule.phases[0]?.start_date;
  if (!phaseStart) {
    throw createAppError(
      "Could not read the current billing period from Stripe.",
      502,
      "PLAN_CHANGE_FAILED"
    );
  }

  await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: "release",
    phases: [
      {
        items: [{ price: currentPriceId, quantity: 1 }],
        start_date: phaseStart,
        end_date: periodEndUnix,
      },
      {
        items: [{ price: targetPriceId, quantity: 1 }],
        start_date: periodEndUnix,
      },
    ],
  });

  await setPendingPlanChange({
    stripeSubscriptionId,
    pendingPlanId: targetPlanId,
    changeAt: periodEnd,
  });

  return {
    ok: true as const,
    mode: "scheduled" as const,
    planSlug: targetSlug,
    changeAt: periodEnd.toISOString(),
  };
};

/**
 * Switch between AU Pro and Business on the existing Stripe subscription.
 * Upgrade: immediate + always_invoice + pending_if_incomplete.
 * Downgrade: at period end via subscription schedule.
 */
const changePlan = async ({
  user,
  planSlug,
}: {
  user: AuthUser;
  planSlug: string;
}) => {
  if (!env.STRIPE_SECRET_KEY) throw stripeNotConfiguredError();
  if (!isAuCardPlanSlug(planSlug)) {
    throw createAppError(
      "Only Pro and Business can be changed this way.",
      400,
      "INVALID_PLAN"
    );
  }

  try {
    const { store, subscription, plan } = await loadOwnerStoreContext(user.id);
    if (!subscription) throw subscriptionRequiredError();

    const stripeSubscriptionId =
      requireActiveStripeSubscription(subscription);
    const currentSlug = plan?.slug ?? "";
    if (currentSlug === planSlug && !subscription.pending_plan_id) {
      throw createAppError(
        "This store is already on that plan.",
        409,
        "ALREADY_SUBSCRIBED"
      );
    }

    const targetPlan = await findPlanBySlug(planSlug);
    if (!targetPlan) {
      throw createAppError("Plan not found.", 404, "PLAN_NOT_FOUND");
    }

    const targetPriceId = priceIdForPlan(planSlug, store.country);

    if (planRank(planSlug) > planRank(currentSlug)) {
      return await upgradeNow({
        stripeSubscriptionId,
        targetPriceId,
        targetPlanId: targetPlan.id,
        targetSlug: planSlug,
      });
    }

    if (planRank(planSlug) < planRank(currentSlug)) {
      return await scheduleDowngradeAtPeriodEnd({
        stripeSubscriptionId,
        targetPriceId,
        targetPlanId: targetPlan.id,
        targetSlug: planSlug,
      });
    }

    throw createAppError(
      "This store is already on that plan.",
      409,
      "ALREADY_SUBSCRIBED"
    );
  } catch (err) {
    return rethrowAsBillingError(
      err,
      "Stripe plan change failed",
      "Could not change plan. Please try again.",
      "PLAN_CHANGE_FAILED"
    );
  }
};

/** Undo a scheduled downgrade ("Keep Business"). */
const cancelScheduledPlanChange = async (user: AuthUser) => {
  if (!env.STRIPE_SECRET_KEY) throw stripeNotConfiguredError();

  try {
    const { subscription } = await loadOwnerStoreContext(user.id);
    if (!subscription) throw subscriptionRequiredError();
    if (!subscription.pending_plan_id || !subscription.stripe_subscription_id) {
      throw createAppError(
        "There is no scheduled plan change to cancel.",
        400,
        "NO_PENDING_CHANGE"
      );
    }

    const stripe = getStripe();
    const current = await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id
    );
    const scheduleId = stripeId(current.schedule);
    if (scheduleId) {
      await stripe.subscriptionSchedules.release(scheduleId);
    }
    await clearPendingPlanChange(subscription.stripe_subscription_id);

    return { ok: true as const };
  } catch (err) {
    return rethrowAsBillingError(
      err,
      "Stripe cancel plan change failed",
      "Could not cancel the scheduled change. Please try again.",
      "PLAN_CHANGE_FAILED"
    );
  }
};

export { cancelScheduledPlanChange, changePlan };
