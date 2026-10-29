import type Stripe from "stripe";
import { env } from "../../config/env.ts";
import { PLAN_SLUGS, SUBSCRIPTION_ERROR_CODES } from "../../constants/plans.ts";
import { marketFromCountry } from "../../constants/markets.ts";
import { createAppError } from "../../lib/appError.ts";
import type { AuthUser } from "../../types/express.d.ts";
import { loadOwnerStoreContext } from "../subscriptions/ownerContext.ts";
import { getStripe } from "./providers/stripe.ts";
import {
  activateSubscription,
  claimWebhookEvent,
  findPlanBySlug,
  findStoreById,
  markWebhookError,
  markWebhookPermanent,
  saveStripeCustomerId,
} from "./billing.repository.ts";

const CHECKOUT_COMPLETED = "checkout.session.completed";

class PermanentBillingError extends Error {
  permanent = true;
  constructor(message: string) {
    super(message);
  }
}

type StripeLikeError = {
  type?: string;
  code?: string;
  message?: string;
};

type PermanentLikeError = Error & { permanent?: boolean };

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
    throw createAppError(
      "Card checkout is not configured.",
      500,
      "STRIPE_NOT_CONFIGURED"
    );
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
    const stripeErr = err as StripeLikeError;
    if (!stripeErr.type?.startsWith("Stripe")) throw err;
    console.error(
      "Stripe checkout failed",
      stripeErr.type,
      stripeErr.code,
      stripeErr.message
    );
    throw createAppError(
      "Could not start checkout. Please try again.",
      502,
      "CHECKOUT_FAILED"
    );
  }
};

const subscriptionPriceId = (
  stripeSubscription: Stripe.Subscription
): string | null => {
  const price = stripeSubscription.items?.data?.[0]?.price;
  if (!price) return null;
  return typeof price === "string" ? price : price.id ?? null;
};

/** Supports the subscription field and the newer item-level field. */
const subscriptionPeriodEnd = (
  stripeSubscription: Stripe.Subscription
): Date | null => {
  const itemPeriodEnd = (
    stripeSubscription.items?.data?.[0] as
      | { current_period_end?: number }
      | undefined
  )?.current_period_end;
  const unix =
    (stripeSubscription as { current_period_end?: number }).current_period_end ??
    itemPeriodEnd ??
    null;
  if (!unix) return null;
  return new Date(unix * 1000);
};

const stripeId = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
};

type CheckoutSessionLike = {
  id?: string | null;
  mode?: string | null;
  status?: string | null;
  payment_status?: string | null;
  subscription?: unknown;
  customer?: unknown;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
};

const sessionSummary = (session: CheckoutSessionLike) => ({
  id: session.id ?? null,
  mode: session.mode ?? null,
  status: session.status ?? null,
  payment_status: session.payment_status ?? null,
  subscription: stripeId(session.subscription),
  customer: stripeId(session.customer),
  client_reference_id: session.client_reference_id ?? null,
  metadata: session.metadata ?? null,
});

const readPaidCheckout = async (session: CheckoutSessionLike) => {
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
 * Applies a verified Stripe event. A repeated event id is ignored once processed.
 * Does nothing for event types this step does not handle.
 */
const applyStripeEvent = async (event: {
  id: string;
  type: string;
  data?: { object?: CheckoutSessionLike };
}) => {
  if (event.type !== CHECKOUT_COMPLETED) return;

  const session = event.data?.object ?? {};
  const row = await claimWebhookEvent(event, sessionSummary(session));
  if (!row) throw new Error("Could not store the webhook event.");
  if (row.processed_at) return;

  try {
    const change = await readPaidCheckout(session);
    await activateSubscription(row, change);
  } catch (err) {
    const billingErr = err as PermanentLikeError;
    if (!billingErr.permanent) {
      await markWebhookError(row, billingErr.message);
      throw err;
    }
    await markWebhookPermanent(row, billingErr.message);
  }
};

export { applyStripeEvent, createCheckoutSession };
