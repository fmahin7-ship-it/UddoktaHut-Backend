import {
  BillingWebhookEvent,
  Plan,
  Store,
  Subscription,
  sequelize,
} from "../../models/RootModel.js";

const findPlanBySlug = (slug) => Plan.findOne({ where: { slug } });

const findStoreById = (storeId) => Store.findByPk(storeId);

const saveStripeCustomerId = (subscriptionId, stripeCustomerId) =>
  Subscription.update(
    { stripe_customer_id: stripeCustomerId },
    { where: { id: subscriptionId } }
  );

const claimWebhookEvent = async (event, payload) => {
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

const markWebhookError = (row, error) =>
  row.update({ error: error || "Webhook processing failed." });

const markWebhookPermanent = (row, error) =>
  row.update({ processed_at: new Date(), error });

const activateSubscription = async (row, change) => {
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
      const missing = new Error("No subscription found for this store.");
      missing.permanent = true;
      throw missing;
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

export {
  activateSubscription,
  claimWebhookEvent,
  findPlanBySlug,
  findStoreById,
  markWebhookError,
  markWebhookPermanent,
  saveStripeCustomerId,
};
