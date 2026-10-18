import { env } from "../../config/env.js";
import { PLAN_SLUGS } from "../../constants/plans.js";
import {
  BillingWebhookEvent,
  Plan,
  Store,
  Subscription,
  sequelize,
} from "../../models/RootModel.js";
import { getStripe } from "./stripeClient.js";

const CHECKOUT_COMPLETED = "checkout.session.completed";

class PermanentBillingError extends Error {
  constructor(message) {
    super(message);
    this.permanent = true;
  }
}

/** Stripe price id configured for a plan. Empty until that plan is billed by card. */
const configuredPriceId = (planSlug) => {
  if (planSlug === PLAN_SLUGS.PRO) return env.STRIPE_PRICE_PRO;
  return "";
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

const claimEvent = async (event, payload) => {
  try {
    const [row] = await BillingWebhookEvent.findOrCreate({
      where: { provider: "stripe", event_id: event.id },
      defaults: {
        event_type: event.type,
        payload_json: payload,
      },
    });
    return row;
  } catch (err) {
    if (err.name !== "SequelizeUniqueConstraintError") throw err;
    return BillingWebhookEvent.findOne({
      where: { provider: "stripe", event_id: event.id },
    });
  }
};

const activatePaidCheckout = async (session) => {
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

  const plan = await Plan.findOne({ where: { slug: planSlug } });
  const store = await Store.findByPk(storeId);
  if (!plan || !store || store.user_id !== userId) {
    throw new PermanentBillingError("Checkout does not match a store on this plan.");
  }

  const cancelAtPeriodEnd = Boolean(stripeSubscription.cancel_at_period_end);

  return {
    planId: plan.id,
    stripeCustomerId,
    stripeSubscriptionId,
    periodEnd,
    cancelAtPeriodEnd,
    storeId: store.id,
  };
};

const savePaidSubscription = async (row, change) => {
  await sequelize.transaction(async (transaction) => {
    const lockedEvent = await BillingWebhookEvent.findOne({
      where: { id: row.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!lockedEvent || lockedEvent.processed_at) return;

    const subscription = await Subscription.findOne({
      where: { store_id: change.storeId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!subscription) {
      throw new PermanentBillingError("No subscription found for this store.");
    }

    await subscription.update(
      {
        plan_id: change.planId,
        status: "active",
        billing_provider: "stripe",
        stripe_customer_id: change.stripeCustomerId,
        stripe_subscription_id: change.stripeSubscriptionId,
        end_date: change.periodEnd,
        is_auto_renew: !change.cancelAtPeriodEnd,
        cancel_at_period_end: change.cancelAtPeriodEnd,
      },
      { transaction }
    );
    await lockedEvent.update(
      { processed_at: new Date(), error: null },
      { transaction }
    );
  });
};

/**
 * Applies a verified Stripe event. A repeated event id is ignored once processed.
 * Does nothing for event types this step does not handle.
 */
const applyStripeEvent = async (event) => {
  if (event.type !== CHECKOUT_COMPLETED) return;

  const session = event.data?.object ?? {};
  const row = await claimEvent(event, sessionSummary(session));
  if (!row) throw new Error("Could not store the webhook event.");
  if (row.processed_at) return;

  try {
    const change = await activatePaidCheckout(session);
    await savePaidSubscription(row, change);
  } catch (err) {
    if (!err.permanent) {
      await row.update({ error: err.message || "Webhook processing failed." });
      throw err;
    }
    await row.update({ processed_at: new Date(), error: err.message });
  }
};

export {
  applyStripeEvent,
  configuredPriceId,
  subscriptionPeriodEnd,
  subscriptionPriceId,
};
