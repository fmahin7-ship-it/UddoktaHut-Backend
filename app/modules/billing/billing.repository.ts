import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.ts";
import {
  billingWebhookEvents,
  plans,
  stores,
  subscriptions,
} from "../../db/schema/index.ts";
import { isPgUniqueViolation } from "../../db/sql.ts";

const findPlanBySlug = async (slug: string) =>
  db.query.plans.findFirst({ where: eq(plans.slug, slug) });

const findStoreById = async (storeId: number) =>
  db.query.stores.findFirst({ where: eq(stores.id, storeId) });

const findSubscriptionByStripeId = async (stripeSubscriptionId: string) =>
  db.query.subscriptions.findFirst({
    where: eq(subscriptions.stripe_subscription_id, stripeSubscriptionId),
  });

const saveStripeCustomerId = async (
  subscriptionId: number,
  stripeCustomerId: string
) => {
  await db
    .update(subscriptions)
    .set({ stripe_customer_id: stripeCustomerId })
    .where(eq(subscriptions.id, subscriptionId));
};

const claimWebhookEvent = async (
  event: { id: string; type: string },
  payload: Record<string, unknown>
) => {
  try {
    const [row] = await db
      .insert(billingWebhookEvents)
      .values({
        provider: "stripe",
        event_id: event.id,
        event_type: event.type,
        payload_json: payload,
      })
      .returning();
    return row;
  } catch (err) {
    if (!isPgUniqueViolation(err)) throw err;
    return db.query.billingWebhookEvents.findFirst({
      where: and(
        eq(billingWebhookEvents.provider, "stripe"),
        eq(billingWebhookEvents.event_id, event.id)
      ),
    });
  }
};

const markWebhookProcessed = async (row: { id: number }) => {
  await db
    .update(billingWebhookEvents)
    .set({ processed_at: new Date(), error: null })
    .where(eq(billingWebhookEvents.id, row.id));
};

const markWebhookError = async (row: { id: number }, error: string) => {
  await db
    .update(billingWebhookEvents)
    .set({ error: error || "Webhook processing failed." })
    .where(eq(billingWebhookEvents.id, row.id));
};

const markWebhookPermanent = async (row: { id: number }, error: string) => {
  await db
    .update(billingWebhookEvents)
    .set({ processed_at: new Date(), error })
    .where(eq(billingWebhookEvents.id, row.id));
};

type SubscriptionChange = {
  storeId: number;
  planId: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  periodEnd: Date;
  cancelAtPeriodEnd: boolean;
};

class PermanentWebhookError extends Error {
  permanent = true;
  constructor(message: string) {
    super(message);
  }
}

/**
 * Activates (or refreshes) Pro from a claimed billing event row.
 * Safe to call twice for the same row — the second call no-ops.
 */
const activateSubscription = async (
  row: { id: number },
  change: SubscriptionChange
) => {
  await db.transaction(async (tx) => {
    const [lockedEvent] = await tx
      .select()
      .from(billingWebhookEvents)
      .where(eq(billingWebhookEvents.id, row.id))
      .for("update");

    if (!lockedEvent || lockedEvent.processed_at) return;

    const [subscription] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.store_id, change.storeId))
      .for("update");

    if (!subscription) {
      throw new PermanentWebhookError("No subscription found for this store.");
    }

    await tx
      .update(subscriptions)
      .set({
        plan_id: change.planId,
        status: "active",
        billing_provider: "stripe",
        stripe_customer_id: change.stripeCustomerId,
        stripe_subscription_id: change.stripeSubscriptionId,
        end_date: change.periodEnd,
        is_auto_renew: !change.cancelAtPeriodEnd,
        cancel_at_period_end: change.cancelAtPeriodEnd,
      })
      .where(eq(subscriptions.id, subscription.id));

    await tx
      .update(billingWebhookEvents)
      .set({ processed_at: new Date(), error: null })
      .where(eq(billingWebhookEvents.id, row.id));
  });
};

/** Month 2+ renew — extend access and keep active. */
const markSubscriptionRenewed = async (opts: {
  stripeSubscriptionId: string;
  periodEnd: Date;
}) => {
  const [updated] = await db
    .update(subscriptions)
    .set({
      status: "active",
      end_date: opts.periodEnd,
      is_auto_renew: true,
      cancel_at_period_end: false,
    })
    .where(eq(subscriptions.stripe_subscription_id, opts.stripeSubscriptionId))
    .returning({ id: subscriptions.id });
  return updated ?? null;
};

/** Card charge failed — keep end_date; access uses past_due + end_date grace. */
const markSubscriptionPastDue = async (stripeSubscriptionId: string) => {
  const [updated] = await db
    .update(subscriptions)
    .set({ status: "past_due", is_auto_renew: false })
    .where(eq(subscriptions.stripe_subscription_id, stripeSubscriptionId))
    .returning({ id: subscriptions.id });
  return updated ?? null;
};

/** Sync cancel flag, status, and optional plan from Stripe subscription.updated. */
const syncSubscriptionFromStripe = async (opts: {
  stripeSubscriptionId: string;
  cancelAtPeriodEnd: boolean;
  periodEnd: Date | null;
  status?: string | null;
  planId?: number | null;
  clearPendingPlan?: boolean;
}) => {
  const [updated] = await db
    .update(subscriptions)
    .set({
      cancel_at_period_end: opts.cancelAtPeriodEnd,
      is_auto_renew: !opts.cancelAtPeriodEnd,
      ...(opts.periodEnd ? { end_date: opts.periodEnd } : {}),
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.planId ? { plan_id: opts.planId } : {}),
      ...(opts.clearPendingPlan
        ? { pending_plan_id: null, pending_plan_change_at: null }
        : {}),
    })
    .where(eq(subscriptions.stripe_subscription_id, opts.stripeSubscriptionId))
    .returning({ id: subscriptions.id });
  return updated ?? null;
};

const setPendingPlanChange = async (opts: {
  stripeSubscriptionId: string;
  pendingPlanId: number;
  changeAt: Date;
}) => {
  const [updated] = await db
    .update(subscriptions)
    .set({
      pending_plan_id: opts.pendingPlanId,
      pending_plan_change_at: opts.changeAt,
    })
    .where(eq(subscriptions.stripe_subscription_id, opts.stripeSubscriptionId))
    .returning({ id: subscriptions.id });
  return updated ?? null;
};

const clearPendingPlanChange = async (stripeSubscriptionId: string) => {
  const [updated] = await db
    .update(subscriptions)
    .set({ pending_plan_id: null, pending_plan_change_at: null })
    .where(eq(subscriptions.stripe_subscription_id, stripeSubscriptionId))
    .returning({ id: subscriptions.id });
  return updated ?? null;
};

const applyPlanImmediately = async (opts: {
  stripeSubscriptionId: string;
  planId: number;
  periodEnd: Date | null;
  status: string;
}) => {
  const [updated] = await db
    .update(subscriptions)
    .set({
      plan_id: opts.planId,
      status: opts.status,
      pending_plan_id: null,
      pending_plan_change_at: null,
      ...(opts.periodEnd ? { end_date: opts.periodEnd } : {}),
      is_auto_renew: true,
      cancel_at_period_end: false,
    })
    .where(eq(subscriptions.stripe_subscription_id, opts.stripeSubscriptionId))
    .returning({ id: subscriptions.id });
  return updated ?? null;
};

/** Stripe subscription fully ended. */
const markSubscriptionEnded = async (stripeSubscriptionId: string) => {
  const [updated] = await db
    .update(subscriptions)
    .set({
      status: "canceled",
      end_date: new Date(),
      is_auto_renew: false,
      cancel_at_period_end: false,
    })
    .where(eq(subscriptions.stripe_subscription_id, stripeSubscriptionId))
    .returning({ id: subscriptions.id });
  return updated ?? null;
};

export {
  activateSubscription,
  applyPlanImmediately,
  claimWebhookEvent,
  clearPendingPlanChange,
  findPlanBySlug,
  findStoreById,
  findSubscriptionByStripeId,
  markSubscriptionEnded,
  syncSubscriptionFromStripe,
  markSubscriptionPastDue,
  markSubscriptionRenewed,
  markWebhookError,
  markWebhookPermanent,
  markWebhookProcessed,
  saveStripeCustomerId,
  setPendingPlanChange,
};
export type { SubscriptionChange };
