import { env } from "../../config/env.js";
import { PLAN_SLUGS, SUBSCRIPTION_ERROR_CODES } from "../../constants/plans.js";
import { marketFromCountry } from "../../constants/markets.js";
import { createAppError } from "../../lib/appError.js";
import { loadOwnerStoreContext } from "../subscription/ownerContext.js";
import { getStripe } from "./stripeClient.js";

const checkoutUnavailable = (message) =>
  createAppError(message, 400, "CHECKOUT_UNAVAILABLE");

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
  await subscription.update({ stripe_customer_id: customer.id });
  return customer.id;
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

export { createCheckoutSession };
