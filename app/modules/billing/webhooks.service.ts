import type Stripe from "stripe";
import { PermanentBillingError, isPermanentBillingError } from "./billing.errors.ts";
import { readPaidCheckout } from "./checkout.service.ts";
import {
  activateSubscription,
  claimWebhookEvent,
  findSubscriptionByStripeId,
  markSubscriptionCancelAtPeriodEnd,
  markSubscriptionEnded,
  markSubscriptionPastDue,
  markSubscriptionRenewed,
  markWebhookError,
  markWebhookPermanent,
  markWebhookProcessed,
} from "./billing.repository.ts";
import { getStripe } from "./providers/stripe.ts";
import {
  CHECKOUT_COMPLETED,
  INVOICE_PAID,
  INVOICE_PAYMENT_FAILED,
  SUBSCRIPTION_DELETED,
  SUBSCRIPTION_UPDATED,
  invoiceSubscriptionId,
  subscriptionPeriodEnd,
  webhookPayloadSummary,
} from "./providers/stripe-mappers.ts";

type WebhookEventRow = { id: number; processed_at: Date | null };

const runClaimedHandler = async (
  row: WebhookEventRow,
  handler: () => Promise<void>
) => {
  try {
    await handler();
    if (!row.processed_at) await markWebhookProcessed(row);
  } catch (err) {
    if (!isPermanentBillingError(err)) {
      const message = err instanceof Error ? err.message : String(err);
      await markWebhookError(row, message);
      throw err;
    }
    await markWebhookPermanent(row, err.message);
  }
};

const handleCheckoutCompleted = async (
  row: WebhookEventRow,
  session: Stripe.Checkout.Session
) => {
  await runClaimedHandler(row, async () => {
    const change = await readPaidCheckout(session);
    await activateSubscription(row, change);
  });
};

const handleInvoicePaid = async (
  row: WebhookEventRow,
  invoice: Stripe.Invoice
) => {
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
  invoice: Stripe.Invoice
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
    const existing = await findSubscriptionByStripeId(stripeSubscription.id);
    if (!existing) return;
    await markSubscriptionCancelAtPeriodEnd({
      stripeSubscriptionId: stripeSubscription.id,
      cancelAtPeriodEnd: Boolean(stripeSubscription.cancel_at_period_end),
      periodEnd: subscriptionPeriodEnd(stripeSubscription),
      status: stripeSubscription.status,
    });
  });
};

const handleSubscriptionDeleted = async (
  row: WebhookEventRow,
  stripeSubscription: Stripe.Subscription
) => {
  await runClaimedHandler(row, async () => {
    const existing = await findSubscriptionByStripeId(stripeSubscription.id);
    if (!existing) return;
    await markSubscriptionEnded(stripeSubscription.id);
  });
};

/**
 * Applies a verified Stripe event. Repeated event ids are ignored once processed.
 * Stripe.Event narrows data.object by event.type in each case.
 */
const applyStripeEvent = async (event: Stripe.Event) => {
  const row = await claimWebhookEvent(
    { id: event.id, type: event.type },
    webhookPayloadSummary(event)
  );
  if (!row) throw new Error("Could not store the webhook event.");
  if (row.processed_at) return;

  switch (event.type) {
    case CHECKOUT_COMPLETED:
      await handleCheckoutCompleted(row, event.data.object);
      return;
    case INVOICE_PAID:
      await handleInvoicePaid(row, event.data.object);
      return;
    case INVOICE_PAYMENT_FAILED:
      await handleInvoicePaymentFailed(row, event.data.object);
      return;
    case SUBSCRIPTION_UPDATED:
      await handleSubscriptionUpdated(row, event.data.object);
      return;
    case SUBSCRIPTION_DELETED:
      await handleSubscriptionDeleted(row, event.data.object);
      return;
    default:
      await markWebhookProcessed(row);
  }
};

export { applyStripeEvent };
