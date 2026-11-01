import type Stripe from "stripe";
import { env } from "../../config/env.ts";
import { PLAN_SLUGS, SUBSCRIPTION_ERROR_CODES } from "../../constants/plans.ts";
import { marketFromCountry } from "../../constants/markets.ts";
import { createAppError } from "../../lib/appError.ts";
import type { AuthUser } from "../../types/express.d.ts";
import { loadOwnerStoreContext } from "../subscriptions/ownerContext.ts";
import {
  PermanentBillingError,
  isPermanentBillingError,
  isStripeSdkError,
  stripeNotConfiguredError,
} from "./billing.errors.ts";
import {
  activateSubscription,
  claimWebhookEvent,
  findPlanBySlug,
  findStoreById,
  saveStripeCustomerId,
  type SubscriptionChange,
} from "./billing.repository.ts";
import { getStripe } from "./providers/stripe.ts";
import {
  sessionSummary,
  stripeId,
  subscriptionPeriodEnd,
  subscriptionPriceId,
} from "./providers/stripe-mappers.ts";

const checkoutUnavailable = (message: string) =>
  createAppError(message, 400, "CHECKOUT_UNAVAILABLE");

/** Stripe price configured for a plan. Empty until that plan is billed by card. */
const configuredPriceId = (planSlug: string): string => {
  if (planSlug === PLAN_SLUGS.PRO) return env.STRIPE_PRICE_PRO;
  return "";
};

/** Price for this plan in the store's market. Only Pro in Australia is configured. */
const priceIdForPlan = (planSlug: string, country: string): string => {
  const market = marketFromCountry(country);
  if (planSlug !== PLAN_SLUGS.PRO || market !== "AU") {
    throw checkoutUnavailable(
      "Card checkout is only available for the Australian Pro plan right now."
    );
  }
  if (!env.STRIPE_PRICE_PRO.startsWith("price_")) {
    throw stripeNotConfiguredError();
  }
  return env.STRIPE_PRICE_PRO;
};

const assertNotAlreadySubscribed = (
  subscription: {
    billing_provider: string | null;
    stripe_subscription_id: string | null;
    status: string | null;
    cancel_at_period_end: boolean;
  },
  plan: { slug: string } | null | undefined,
  planSlug: string
) => {
  const renewing =
    plan?.slug === planSlug &&
    subscription.billing_provider === "stripe" &&
    subscription.stripe_subscription_id &&
    subscription.status === "active" &&
    !subscription.cancel_at_period_end;

  if (renewing) {
    throw createAppError(
      "This store is already on that plan.",
      409,
      "ALREADY_SUBSCRIBED"
    );
  }
};

const ensureStripeCustomer = async (
  stripe: Stripe,
  {
    user,
    store,
    subscription,
  }: {
    user: AuthUser;
    store: { id: number };
    subscription: { id: number; stripe_customer_id: string | null };
  }
) => {
  if (subscription.stripe_customer_id) return subscription.stripe_customer_id;

  const customer = await stripe.customers.create({
    email: user.email || undefined,
    name: user.name,
    metadata: {
      user_id: String(user.id),
      store_id: String(store.id),
    },
  });
  await saveStripeCustomerId(subscription.id, customer.id);
  return customer.id;
};

const openCheckoutSession = async (user: AuthUser, planSlug: string) => {
  if (!env.STRIPE_SECRET_KEY) throw stripeNotConfiguredError();

  const { store, subscription, plan } = await loadOwnerStoreContext(user.id);
  if (!subscription) {
    throw createAppError(
      "No subscription found. Please subscribe to continue.",
      403,
      SUBSCRIPTION_ERROR_CODES.SUBSCRIPTION_REQUIRED
    );
  }

  assertNotAlreadySubscribed(subscription, plan, planSlug);
  const priceId = priceIdForPlan(planSlug, store.country);
  const stripe = getStripe();
  const customerId = await ensureStripeCustomer(stripe, {
    user,
    store,
    subscription,
  });

  const base = env.APP_PUBLIC_URL.replace(/\/$/, "");
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: String(store.id),
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/dashboard/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/dashboard/billing?checkout=cancel`,
    metadata: {
      store_id: String(store.id),
      user_id: String(user.id),
      plan_slug: planSlug,
    },
    subscription_data: {
      metadata: {
        store_id: String(store.id),
        user_id: String(user.id),
        plan_slug: planSlug,
      },
    },
  });

  if (!session.url) {
    throw createAppError(
      "Stripe did not return a checkout link.",
      502,
      "CHECKOUT_FAILED"
    );
  }

  return { url: session.url };
};

/**
 * Opens Stripe Checkout for the requested plan. Does not change the store's plan.
 * The plan changes when the webhook or confirmCheckoutSession succeeds.
 */
const createCheckoutSession = async ({
  user,
  planSlug,
}: {
  user: AuthUser;
  planSlug: string;
}) => {
  try {
    return await openCheckoutSession(user, planSlug);
  } catch (err) {
    if (!isStripeSdkError(err)) throw err;
    console.error("Stripe checkout failed", err.type, err.code, err.message);
    throw createAppError(
      "Could not start checkout. Please try again.",
      502,
      "CHECKOUT_FAILED"
    );
  }
};

/**
 * Validates a paid Checkout Session and returns the local subscription change.
 * Used by confirm-checkout and the checkout.session.completed webhook.
 */
const readPaidCheckout = async (
  session: Stripe.Checkout.Session
): Promise<SubscriptionChange> => {
  const planSlug = session.metadata?.plan_slug;
  const storeId = Number(session.metadata?.store_id);
  const userId = Number(session.metadata?.user_id);
  const priceId = configuredPriceId(planSlug ?? "");

  if (!Number.isInteger(storeId) || storeId < 1 || !Number.isInteger(userId)) {
    throw new PermanentBillingError("Checkout is missing the store or user.");
  }
  if (session.client_reference_id !== String(storeId)) {
    throw new PermanentBillingError("Checkout store reference does not match.");
  }
  if (session.mode !== "subscription" || session.status !== "complete") {
    throw new PermanentBillingError("Checkout is not a completed subscription.");
  }
  if (session.payment_status !== "paid") {
    throw new PermanentBillingError("Checkout was not paid.");
  }
  if (!priceId.startsWith("price_")) {
    throw new PermanentBillingError(
      "This plan is not available for card checkout."
    );
  }

  const stripeSubscriptionId = stripeId(session.subscription);
  const stripeCustomerId = stripeId(session.customer);
  if (!stripeSubscriptionId || !stripeCustomerId) {
    throw new PermanentBillingError(
      "Checkout is missing the Stripe subscription."
    );
  }

  const stripeSubscription = await getStripe().subscriptions.retrieve(
    stripeSubscriptionId
  );
  if (subscriptionPriceId(stripeSubscription) !== priceId) {
    throw new PermanentBillingError("Paid price does not match this plan.");
  }
  const periodEnd = subscriptionPeriodEnd(stripeSubscription);
  if (!periodEnd || Number.isNaN(periodEnd.getTime())) {
    throw new Error("Stripe subscription has no period end.");
  }

  const plan = await findPlanBySlug(planSlug ?? "");
  const store = await findStoreById(storeId);
  if (!plan || !store || store.user_id !== userId) {
    throw new PermanentBillingError(
      "Checkout does not match a store on this plan."
    );
  }

  return {
    planId: plan.id,
    stripeCustomerId,
    stripeSubscriptionId,
    periodEnd,
    cancelAtPeriodEnd: Boolean(stripeSubscription.cancel_at_period_end),
    storeId: store.id,
  };
};

/**
 * Seller returned from Stripe Checkout. Ask Stripe directly — same activation
 * as the webhook. Safe if the webhook already ran (or runs later).
 */
const confirmCheckoutSession = async ({
  user,
  sessionId,
}: {
  user: AuthUser;
  sessionId: string;
}) => {
  if (!env.STRIPE_SECRET_KEY) throw stripeNotConfiguredError();

  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  const metaUserId = Number(session.metadata?.user_id);
  if (!Number.isInteger(metaUserId) || metaUserId !== user.id) {
    throw createAppError(
      "This checkout does not belong to you.",
      403,
      "CHECKOUT_FORBIDDEN"
    );
  }

  let change: SubscriptionChange;
  try {
    change = await readPaidCheckout(session);
  } catch (err) {
    if (isPermanentBillingError(err)) {
      throw createAppError(err.message, 400, "CHECKOUT_NOT_PAID");
    }
    throw err;
  }

  const row = await claimWebhookEvent(
    { id: `confirm_${session.id}`, type: "checkout.session.confirm" },
    sessionSummary(session)
  );
  if (!row) {
    throw createAppError(
      "Could not record checkout confirmation.",
      500,
      "CONFIRM_FAILED"
    );
  }
  if (row.processed_at) {
    return { ok: true as const, alreadyActive: true };
  }

  await activateSubscription(row, change);
  return { ok: true as const, alreadyActive: false };
};

export {
  confirmCheckoutSession,
  createCheckoutSession,
  readPaidCheckout,
};
