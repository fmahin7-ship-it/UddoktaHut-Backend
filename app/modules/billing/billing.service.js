import { env } from "../../config/env.js";
import { PLAN_SLUGS, SUBSCRIPTION_ERROR_CODES } from "../../constants/plans.js";
import { marketFromCountry } from "../../constants/markets.js";
import { createAppError } from "../../lib/appError.js";
import { loadOwnerStoreContext } from "../subscriptions/ownerContext.js";
import { getStripe } from "./providers/stripe.js";
import {
  activateSubscription,
  claimWebhookEvent,
  findPlanBySlug,
  findStoreById,
  markWebhookError,
  markWebhookPermanent,
  saveStripeCustomerId,
} from "./billing.repository.js";

const CHECKOUT_COMPLETED = "checkout.session.completed";

class PermanentBillingError extends Error {
  constructor(message) {
    super(message);
    this.permanent = true;
  }
}

const checkoutUnavailable = (message) =>
  createAppError(message, 400, "CHECKOUT_UNAVAILABLE");

/** Stripe price configured for a plan. Empty until that plan is billed by card. */
const configuredPriceId = (planSlug) => {
  if (planSlug === PLAN_SLUGS.PRO) return env.STRIPE_PRICE_PRO;
  return "";
};

/** Price for this plan in the store's market. Only Pro in Australia is configured. */
const priceIdForPlan = (planSlug, country) => {
  const market = marketFromCountry(country);
  if (planSlug !== PLAN_SLUGS.PRO || market !== "AU") {
    throw checkoutUnavailable(
      "Card checkout is only available for the Australian Pro plan right now."
    );
  }
  if (!env.STRIPE_PRICE_PRO.startsWith("price_")) {
    throw createAppError(
      "Card checkout is not configured.",
      500,
      "STRIPE_NOT_CONFIGURED"
    );
  }
  return env.STRIPE_PRICE_PRO;
};

const assertNotAlreadySubscribed = (subscription, plan, planSlug) => {
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

const ensureStripeCustomer = async (stripe, { user, store, subscription }) => {
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

const openCheckoutSession = async (user, planSlug) => {
  if (!env.STRIPE_SECRET_KEY) {
    throw createAppError(
      "Card checkout is not configured.",
      500,
      "STRIPE_NOT_CONFIGURED"
    );
  }

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
 * The plan changes only when the webhook confirms payment.
 */
const createCheckoutSession = async ({ user, planSlug }) => {
  try {
    return await openCheckoutSession(user, planSlug);
  } catch (err) {
    if (!err.type?.startsWith("Stripe")) throw err;
    console.error("Stripe checkout failed", err.type, err.code, err.message);
    throw createAppError(
      "Could not start checkout. Please try again.",
      502,
      "CHECKOUT_FAILED"
    );
  }
};

const subscriptionPriceId = (stripeSubscription) => {
  const price = stripeSubscription.items?.data?.[0]?.price;
  if (!price) return null;
  return typeof price === "string" ? price : price.id ?? null;
};

/** Supports the subscription field and the newer item-level field. */
const subscriptionPeriodEnd = (stripeSubscription) => {
  const unix =
    stripeSubscription.current_period_end ??
    stripeSubscription.items?.data?.[0]?.current_period_end ??
    null;
  if (!unix) return null;
  return new Date(unix * 1000);
};

const stripeId = (value) => {
  if (!value) return null;
  return typeof value === "string" ? value : value.id ?? null;
};

const sessionSummary = (session) => ({
  id: session.id ?? null,
  mode: session.mode ?? null,
  status: session.status ?? null,
  payment_status: session.payment_status ?? null,
  subscription: stripeId(session.subscription),
  customer: stripeId(session.customer),
  client_reference_id: session.client_reference_id ?? null,
  metadata: session.metadata ?? null,
});

const readPaidCheckout = async (session) => {
  const planSlug = session.metadata?.plan_slug;
  const storeId = Number(session.metadata?.store_id);
  const userId = Number(session.metadata?.user_id);
  const priceId = configuredPriceId(planSlug);

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
    throw new PermanentBillingError("This plan is not available for card checkout.");
  }

  const stripeSubscriptionId = stripeId(session.subscription);
  const stripeCustomerId = stripeId(session.customer);
  if (!stripeSubscriptionId || !stripeCustomerId) {
    throw new PermanentBillingError("Checkout is missing the Stripe subscription.");
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

  const plan = await findPlanBySlug(planSlug);
  const store = await findStoreById(storeId);
  if (!plan || !store || store.user_id !== userId) {
    throw new PermanentBillingError("Checkout does not match a store on this plan.");
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
 * Applies a verified Stripe event. A repeated event id is ignored once processed.
 * Does nothing for event types this step does not handle.
 */
const applyStripeEvent = async (event) => {
  if (event.type !== CHECKOUT_COMPLETED) return;

  const session = event.data?.object ?? {};
  const row = await claimWebhookEvent(event, sessionSummary(session));
  if (!row) throw new Error("Could not store the webhook event.");
  if (row.processed_at) return;

  try {
    const change = await readPaidCheckout(session);
    await activateSubscription(row, change);
  } catch (err) {
    if (!err.permanent) {
      await markWebhookError(row, err.message);
      throw err;
    }
    await markWebhookPermanent(row, err.message);
  }
};

export { applyStripeEvent, createCheckoutSession };
