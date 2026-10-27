import assert from "node:assert/strict";
import { mock, test } from "node:test";
import bcrypt from "bcrypt";
import { env } from "../app/config/env.js";
import {
  BillingWebhookEvent,
  Order,
  OrderItem,
  Plan,
  Product,
  sequelize,
  Store,
  Subscription,
  User,
} from "../app/models/RootModel.js";
import { createStoreOrder } from "../app/modules/orders/orders.service.js";

const fakeSubscription = {
  id: "sub_test_handcheck",
  cancel_at_period_end: false,
  current_period_end: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  items: { data: [{ price: { id: env.STRIPE_PRICE_PRO } }] },
};

mock.module("../app/modules/billing/providers/stripe.js", {
  namedExports: {
    getStripe: () => ({
      subscriptions: {
        retrieve: async () => fakeSubscription,
      },
    }),
  },
});

const { createCheckoutSession, applyStripeEvent } = await import(
  "../app/modules/billing/billing.service.js"
);

const password = bcrypt.hashSync("Handcheck123", 10);

const createOwner = async ({ country, planSlug, subscriptionFields = {} }) => {
  const plan = await Plan.findOne({ where: { slug: planSlug } });
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const user = await User.create({
    email: `handcheck-${stamp}@example.com`,
    name: "Handcheck",
    password,
  });
  const store = await Store.create({
    user_id: user.id,
    store_name: `handcheck-${stamp}`,
    store_url: `handcheck-${stamp}.uddoktahut.local`,
    store_type: "retail",
    country,
  });
  const subscription = await Subscription.create({
    store_id: store.id,
    status: "trialing",
    start_date: new Date(),
    trial_ends_at: new Date(Date.now() + 7 * 86400000),
    end_date: new Date(Date.now() + 7 * 86400000),
    is_auto_renew: false,
    plan_id: plan.id,
    cancel_at_period_end: false,
    ...subscriptionFields,
  });
  return { user, store, subscription, plan };
};

const removeOwner = async ({ user, store }) => {
  const orders = await Order.findAll({ where: { store_id: store.id } });
  const orderIds = orders.map((order) => order.id);
  if (orderIds.length) {
    await OrderItem.destroy({ where: { order_id: orderIds } });
  }
  await Order.destroy({ where: { store_id: store.id } });
  await Subscription.destroy({ where: { store_id: store.id } });
  await Product.destroy({ where: { store_id: store.id } });
  await Store.destroy({ where: { id: store.id } });
  await User.destroy({ where: { id: user.id } });
};

test("a Bangladesh store cannot open card checkout", async () => {
  const owner = await createOwner({ country: "BD", planSlug: "trial" });
  try {
    await assert.rejects(
      () => createCheckoutSession({ user: owner.user, planSlug: "pro" }),
      (err) => err.code === "CHECKOUT_UNAVAILABLE" && err.statusCode === 400
    );
  } finally {
    await removeOwner(owner);
  }
});

test("an Australian store already renewing Pro is not sent to checkout again", async () => {
  const owner = await createOwner({
    country: "AU",
    planSlug: "pro",
    subscriptionFields: {
      status: "active",
      billing_provider: "stripe",
      stripe_customer_id: "cus_handcheck",
      stripe_subscription_id: "sub_handcheck",
      cancel_at_period_end: false,
    },
  });
  try {
    await assert.rejects(
      () => createCheckoutSession({ user: owner.user, planSlug: "pro" }),
      (err) => err.code === "ALREADY_SUBSCRIBED" && err.statusCode === 409
    );
  } finally {
    await removeOwner(owner);
  }
});

test("a paid checkout webhook switches the store to Pro", async () => {
  const owner = await createOwner({ country: "AU", planSlug: "trial" });
  const eventId = `evt_test_${owner.store.id}`;
  try {
    await applyStripeEvent({
      id: eventId,
      type: "checkout.session.completed",
      data: {
        object: {
          id: `cs_test_${owner.store.id}`,
          mode: "subscription",
          status: "complete",
          payment_status: "paid",
          client_reference_id: String(owner.store.id),
          customer: "cus_test_handcheck",
          subscription: "sub_test_handcheck",
          metadata: {
            store_id: String(owner.store.id),
            user_id: String(owner.user.id),
            plan_slug: "pro",
          },
        },
      },
    });
    const updated = await Subscription.findOne({ where: { store_id: owner.store.id } });
    const pro = await Plan.findOne({ where: { slug: "pro" } });
    assert.equal(updated.plan_id, pro.id);
    assert.equal(updated.status, "active");
    assert.equal(updated.billing_provider, "stripe");
    assert.equal(updated.stripe_subscription_id, "sub_test_handcheck");
    assert.ok(updated.end_date > new Date());

    await applyStripeEvent({
      id: eventId,
      type: "checkout.session.completed",
      data: { object: {} },
    });
    const again = await Subscription.findOne({ where: { store_id: owner.store.id } });
    assert.equal(again.stripe_subscription_id, "sub_test_handcheck");
  } finally {
    await BillingWebhookEvent.destroy({ where: { event_id: eventId } });
    await removeOwner(owner);
  }
});

test("two orders cannot take the same last units of stock", async () => {
  const owner = await createOwner({ country: "BD", planSlug: "business" });
  const product = await Product.create({
    name: "Handcheck shoe",
    price: 10,
    stock: 2,
    status: "active",
    category: "shoes",
    sku: `handcheck-${owner.store.id}`,
    user_id: owner.user.id,
    store_id: owner.store.id,
  });
  const payload = {
    customer: {
      name: "Handcheck Customer",
      phone: "01711111111",
      address: "Handcheck road, Dhaka",
    },
    items: [{ productId: product.id, quantity: 2 }],
    paymentMethod: "cod",
  };
  try {
    const results = await Promise.allSettled([
      createStoreOrder(owner.store.store_name, payload),
      createStoreOrder(owner.store.store_name, payload),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].reason.statusCode, 409);
    await product.reload();
    assert.equal(product.stock, 0);
  } finally {
    await removeOwner(owner);
  }
});

test.after(async () => {
  await sequelize.close();
});
