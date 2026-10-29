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

export {
  activateSubscription,
  claimWebhookEvent,
  findPlanBySlug,
  findStoreById,
  markWebhookError,
  markWebhookPermanent,
  saveStripeCustomerId,
};
