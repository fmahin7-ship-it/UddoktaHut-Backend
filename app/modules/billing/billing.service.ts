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
  findSubscriptionByStripeId,
  markSubscriptionCancelAtPeriodEnd,
  markSubscriptionEnded,
  markSubscriptionPastDue,
  markSubscriptionRenewed,
  markWebhookError,
  markWebhookPermanent,
  markWebhookProcessed,
  saveStripeCustomerId,
  type SubscriptionChange,
} from "./billing.repository.ts";

const CHECKOUT_COMPLETED = "checkout.session.completed";
const INVOICE_PAID = "invoice.paid";
const INVOICE_PAYMENT_FAILED = "invoice.payment_failed";
const SUBSCRIPTION_UPDATED = "customer.subscription.updated";
const SUBSCRIPTION_DELETED = "customer.subscription.deleted";

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

type WebhookEventRow = { id: number; processed_at: Date | null };

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

/** Old API: invoice.subscription. Newer API: parent.subscription_details.subscription. */
type InvoiceLike = {
  id?: unknown;
  status?: unknown;
  billing_reason?: unknown;
  customer?: unknown;
  subscription?: unknown;
  parent?: {
    subscription_details?: { subscription?: unknown } | null;
  } | null;
};

const invoiceSubscriptionId = (invoice: InvoiceLike): string | null =>
  stripeId(invoice.subscription) ??
  stripeId(invoice.parent?.subscription_details?.subscription);

const invoiceSummary = (invoice: InvoiceLike) => ({
  id: stripeId(invoice.id) ?? (typeof invoice.id === "string" ? invoice.id : null),
  status: typeof invoice.status === "string" ? invoice.status : null,
  billing_reason:
    typeof invoice.billing_reason === "string" ? invoice.billing_reason : null,
  customer: stripeId(invoice.customer),
  subscription: invoiceSubscriptionId(invoice),
});

const subscriptionSummary = (sub: {
  id?: unknown;
  status?: unknown;
  cancel_at_period_end?: unknown;
  customer?: unknown;
  current_period_end?: unknown;
}) => ({
  id: stripeId(sub.id),
  status: typeof sub.status === "string" ? sub.status : null,
  cancel_at_period_end: Boolean(sub.cancel_at_period_end),
  customer: stripeId(sub.customer),
  current_period_end:
    typeof sub.current_period_end === "number" ? sub.current_period_end : null,
});

/** Short JSON for billing_webhook_events — not the full Stripe blob. */
const webhookPayloadSummary = (
  type: string,
  object: Record<string, unknown>
): Record<string, unknown> => {
  switch (type) {
    case CHECKOUT_COMPLETED:
      return sessionSummary(object as CheckoutSessionLike);
    case INVOICE_PAID:
    case INVOICE_PAYMENT_FAILED:
      return invoiceSummary(object as InvoiceLike);
    case SUBSCRIPTION_UPDATED:
    case SUBSCRIPTION_DELETED:
      return subscriptionSummary(object);
    default:
      return {
        id: stripeId(object.id),
        object:
          typeof object.object === "string" ? object.object : null,
      };
  }
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

const readPaidCheckout = async (
  session: CheckoutSessionLike
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

const runClaimedHandler = async (
  row: WebhookEventRow,
  handler: () => Promise<void>
) => {
  try {
    await handler();
    if (!row.processed_at) await markWebhookProcessed(row);
  } catch (err) {
    const billingErr = err as PermanentLikeError;
    if (!billingErr.permanent) {
      await markWebhookError(row, billingErr.message);
      throw err;
    }
    await markWebhookPermanent(row, billingErr.message);
  }
};

const handleCheckoutCompleted = async (
  row: WebhookEventRow,
  session: CheckoutSessionLike
) => {
  await runClaimedHandler(row, async () => {
    const change = await readPaidCheckout(session);
    await activateSubscription(row, change);
  });
};

const handleInvoicePaid = async (row: WebhookEventRow, invoice: InvoiceLike) => {
  await runClaimedHandler(row, async () => {
    const stripeSubscriptionId = invoiceSubscriptionId(invoice);
    if (!stripeSubscriptionId) {
      throw new PermanentBillingError("Invoice has no subscription.");
    }
    const existing = await findSubscriptionByStripeId(stripeSubscriptionId);
    // First invoice can arrive before checkout.session.completed links the id.
    if (!existing) return;

    const stripeSub =
      await getStripe().subscriptions.retrieve(stripeSubscriptionId);
    const periodEnd = subscriptionPeriodEnd(stripeSub);
    if (!periodEnd) throw new Error("Stripe subscription has no period end.");

    await markSubscriptionRenewed({ stripeSubscriptionId, periodEnd });
  });
};

const handleInvoicePaymentFailed = async (
  row: WebhookEventRow,
  invoice: InvoiceLike
) => {
  await runClaimedHandler(row, async () => {
    const stripeSubscriptionId = invoiceSubscriptionId(invoice);
    if (!stripeSubscriptionId) {
      throw new PermanentBillingError("Failed invoice has no subscription.");
    }
    const existing = await findSubscriptionByStripeId(stripeSubscriptionId);
    if (!existing) return;
    await markSubscriptionPastDue(stripeSubscriptionId);
  });
};

const handleSubscriptionUpdated = async (
  row: WebhookEventRow,
  stripeSubscription: Stripe.Subscription
) => {
  await runClaimedHandler(row, async () => {
    const stripeSubscriptionId = stripeSubscription.id;
    const existing = await findSubscriptionByStripeId(stripeSubscriptionId);
    if (!existing) return;
    await markSubscriptionCancelAtPeriodEnd({
      stripeSubscriptionId,
      cancelAtPeriodEnd: Boolean(stripeSubscription.cancel_at_period_end),
      periodEnd: subscriptionPeriodEnd(stripeSubscription),
      status: stripeSubscription.status,
    });
  });
};

const handleSubscriptionDeleted = async (
  row: WebhookEventRow,
  stripeSubscription: { id: string }
) => {
  await runClaimedHandler(row, async () => {
    const existing = await findSubscriptionByStripeId(stripeSubscription.id);
    if (!existing) return;
    await markSubscriptionEnded(stripeSubscription.id);
  });
};

/**
 * Applies a verified Stripe event. Repeated event ids are ignored once processed.
 */
const applyStripeEvent = async (event: {
  id: string;
  type: string;
  data?: { object?: Record<string, unknown> };
}) => {
  const object = event.data?.object ?? {};
  const row = await claimWebhookEvent(
    event,
    webhookPayloadSummary(event.type, object)
  );
  if (!row) throw new Error("Could not store the webhook event.");
  if (row.processed_at) return;

  switch (event.type) {
    case CHECKOUT_COMPLETED:
      await handleCheckoutCompleted(row, object as CheckoutSessionLike);
      return;
    case INVOICE_PAID:
      await handleInvoicePaid(row, object as InvoiceLike);
      return;
    case INVOICE_PAYMENT_FAILED:
      await handleInvoicePaymentFailed(row, object as InvoiceLike);
      return;
    case SUBSCRIPTION_UPDATED:
      await handleSubscriptionUpdated(
        row,
        object as unknown as Stripe.Subscription
      );
      return;
    case SUBSCRIPTION_DELETED:
      await handleSubscriptionDeleted(row, object as { id: string });
      return;
    default:
      await markWebhookProcessed(row);
  }
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
  if (!env.STRIPE_SECRET_KEY) {
    throw createAppError(
      "Card checkout is not configured.",
      500,
      "STRIPE_NOT_CONFIGURED"
    );
  }

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
    const permanent = err as PermanentLikeError;
    if (permanent.permanent) {
      throw createAppError(permanent.message, 400, "CHECKOUT_NOT_PAID");
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

/** Stripe-hosted portal for cancel, card update, and invoices. */
const createBillingPortalSession = async (user: AuthUser) => {
  if (!env.STRIPE_SECRET_KEY) {
    throw createAppError(
      "Card checkout is not configured.",
      500,
      "STRIPE_NOT_CONFIGURED"
    );
  }

  const { subscription } = await loadOwnerStoreContext(user.id);
  if (!subscription?.stripe_customer_id) {
    throw createAppError(
      "No Stripe billing account for this store yet.",
      400,
      "PORTAL_UNAVAILABLE"
    );
  }

  const base = env.APP_PUBLIC_URL.replace(/\/$/, "");
  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${base}/dashboard/billing`,
    });
    if (!portal.url) {
      throw createAppError(
        "Stripe did not return a billing portal link.",
        502,
        "PORTAL_FAILED"
      );
    }
    return { url: portal.url };
  } catch (err) {
    const stripeErr = err as StripeLikeError;
    if (!stripeErr.type?.startsWith("Stripe")) throw err;
    console.error(
      "Stripe portal failed",
      stripeErr.type,
      stripeErr.code,
      stripeErr.message
    );
    throw createAppError(
      "Could not open billing portal. Please try again.",
      502,
      "PORTAL_FAILED"
    );
  }
};

export {
  applyStripeEvent,
  confirmCheckoutSession,
  createBillingPortalSession,
  createCheckoutSession,
};
