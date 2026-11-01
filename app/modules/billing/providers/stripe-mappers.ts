import type Stripe from "stripe";

const CHECKOUT_COMPLETED = "checkout.session.completed";
const INVOICE_PAID = "invoice.paid";
const INVOICE_PAYMENT_FAILED = "invoice.payment_failed";
const SUBSCRIPTION_UPDATED = "customer.subscription.updated";
const SUBSCRIPTION_DELETED = "customer.subscription.deleted";

const stripeId = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
};

const subscriptionPriceId = (
  stripeSubscription: Stripe.Subscription
): string | null => {
  const price = stripeSubscription.items?.data?.[0]?.price;
  if (!price) return null;
  return typeof price === "string" ? price : price.id ?? null;
};

/** Subscription and newer item-level current_period_end. */
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

/**
 * Old API: invoice.subscription (removed from newest Stripe types).
 * Newer API: invoice.parent.subscription_details.subscription.
 */
const invoiceSubscriptionId = (invoice: Stripe.Invoice): string | null => {
  const legacy = invoice as Stripe.Invoice & {
    subscription?: unknown;
    parent?: {
      subscription_details?: { subscription?: unknown } | null;
    } | null;
  };
  return (
    stripeId(legacy.subscription) ??
    stripeId(legacy.parent?.subscription_details?.subscription)
  );
};

const sessionSummary = (session: Stripe.Checkout.Session) => ({
  id: session.id ?? null,
  mode: session.mode ?? null,
  status: session.status ?? null,
  payment_status: session.payment_status ?? null,
  subscription: stripeId(session.subscription),
  customer: stripeId(session.customer),
  client_reference_id: session.client_reference_id ?? null,
  metadata: session.metadata ?? null,
});

const invoiceSummary = (invoice: Stripe.Invoice) => ({
  id: invoice.id,
  status: invoice.status ?? null,
  billing_reason: invoice.billing_reason ?? null,
  customer: stripeId(invoice.customer),
  subscription: invoiceSubscriptionId(invoice),
});

const subscriptionSummary = (sub: Stripe.Subscription) => ({
  id: sub.id,
  status: sub.status,
  cancel_at_period_end: Boolean(sub.cancel_at_period_end),
  customer: stripeId(sub.customer),
  current_period_end:
    typeof (sub as { current_period_end?: number }).current_period_end ===
    "number"
      ? (sub as { current_period_end?: number }).current_period_end!
      : null,
});

/** Short JSON for billing_webhook_events — not the full Stripe blob. */
const webhookPayloadSummary = (
  event: Stripe.Event
): Record<string, unknown> => {
  switch (event.type) {
    case CHECKOUT_COMPLETED:
      return sessionSummary(event.data.object);
    case INVOICE_PAID:
    case INVOICE_PAYMENT_FAILED:
      return invoiceSummary(event.data.object);
    case SUBSCRIPTION_UPDATED:
    case SUBSCRIPTION_DELETED:
      return subscriptionSummary(event.data.object);
    default:
      return {
        id: "id" in event.data.object ? stripeId(event.data.object.id) : null,
        object: event.type,
      };
  }
};

export {
  CHECKOUT_COMPLETED,
  INVOICE_PAID,
  INVOICE_PAYMENT_FAILED,
  SUBSCRIPTION_DELETED,
  SUBSCRIPTION_UPDATED,
  invoiceSubscriptionId,
  sessionSummary,
  stripeId,
  subscriptionPeriodEnd,
  subscriptionPriceId,
  webhookPayloadSummary,
};
