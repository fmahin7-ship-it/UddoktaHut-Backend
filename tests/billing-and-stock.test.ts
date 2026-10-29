import assert from "node:assert/strict";
import { mock, test } from "node:test";
import bcrypt from "bcrypt";
import { eq, inArray } from "drizzle-orm";
import { env } from "../app/config/env.ts";
import { db, pool } from "../app/db/client.ts";
import {
  billingWebhookEvents,
  orderItems,
  orders,
  plans,
  products,
  stores,
  subscriptions,
  users,
} from "../app/db/schema/index.ts";
import { createStoreOrder } from "../app/modules/orders/orders.service.ts";

const fakeSubscription = {
  id: "sub_test_handcheck",
  cancel_at_period_end: false,
  current_period_end: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  items: { data: [{ price: { id: env.STRIPE_PRICE_PRO } }] },
};

mock.module("../app/modules/billing/providers/stripe.ts", {
  namedExports: {
    getStripe: () => ({
      subscriptions: {
        retrieve: async () => fakeSubscription,
      },
    }),
  },
});

const { createCheckoutSession, applyStripeEvent } = await import(
  "../app/modules/billing/billing.service.ts"
);

const password = bcrypt.hashSync("Handcheck123", 10);

const createOwner = async ({
  country,
  planSlug,
  subscriptionFields = {},
}: {
  country: string;
  planSlug: string;
  subscriptionFields?: Record<string, unknown>;
}) => {
  const plan = await db.query.plans.findFirst({
    where: eq(plans.slug, planSlug),
  });
  if (!plan) throw new Error(`Plan missing: ${planSlug}`);
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const [user] = await db
    .insert(users)
    .values({
      email: `handcheck-${stamp}@example.com`,
      name: "Handcheck",
      password,
    })
    .returning();
  const [store] = await db
    .insert(stores)
    .values({
      user_id: user!.id,
      store_name: `handcheck-${stamp}`,
      store_url: `handcheck-${stamp}.uddoktahut.local`,
      store_type: "retail",
      country,
    })
    .returning();
  const [subscription] = await db
    .insert(subscriptions)
    .values({
      store_id: store!.id,
      status: "trialing",
      start_date: new Date(),
      trial_ends_at: new Date(Date.now() + 7 * 86400000),
      end_date: new Date(Date.now() + 7 * 86400000),
      is_auto_renew: false,
      plan_id: plan.id,
      cancel_at_period_end: false,
      ...subscriptionFields,
    })
    .returning();
  return { user: user!, store: store!, subscription: subscription!, plan };
};

const removeOwner = async ({
  user,
  store,
}: {
  user: { id: number };
  store: { id: number };
}) => {
  const orderRows = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.store_id, store.id));
  const orderIds = orderRows.map((order) => order.id);
  if (orderIds.length) {
    await db.delete(orderItems).where(inArray(orderItems.order_id, orderIds));
  }
  await db.delete(orders).where(eq(orders.store_id, store.id));
  await db.delete(subscriptions).where(eq(subscriptions.store_id, store.id));
  await db.delete(products).where(eq(products.store_id, store.id));
  await db.delete(stores).where(eq(stores.id, store.id));
  await db.delete(users).where(eq(users.id, user.id));
};

test("a Bangladesh store cannot open card checkout", async () => {
  const owner = await createOwner({ country: "BD", planSlug: "trial" });
  try {
    await assert.rejects(
      () => createCheckoutSession({ user: owner.user, planSlug: "pro" }),
      (err: Error & { code?: string; statusCode?: number }) =>
        err.code === "CHECKOUT_UNAVAILABLE" && err.statusCode === 400
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
      (err: Error & { code?: string; statusCode?: number }) =>
        err.code === "ALREADY_SUBSCRIBED" && err.statusCode === 409
    );
  } finally {
    await removeOwner(owner);
  }
});

test("a paid checkout webhook switches the store to Pro", async () => {
  const owner = await createOwner({ country: "AU", planSlug: "trial" });
  const eventId = `evt_test_${owner.store.id}_${Date.now()}`;
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
    const updated = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.store_id, owner.store.id),
    });
    const pro = await db.query.plans.findFirst({
      where: eq(plans.slug, "pro"),
    });
    assert.equal(updated!.plan_id, pro!.id);
    assert.equal(updated!.status, "active");
    assert.equal(updated!.billing_provider, "stripe");
    assert.equal(updated!.stripe_subscription_id, "sub_test_handcheck");
    assert.ok(updated!.end_date! > new Date());

    await applyStripeEvent({
      id: eventId,
      type: "checkout.session.completed",
      data: { object: {} },
    });
    const again = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.store_id, owner.store.id),
    });
    assert.equal(again!.stripe_subscription_id, "sub_test_handcheck");
  } finally {
    await db
      .delete(billingWebhookEvents)
      .where(eq(billingWebhookEvents.event_id, eventId));
    await removeOwner(owner);
  }
});

test("two orders cannot take the same last units of stock", async () => {
  const owner = await createOwner({ country: "BD", planSlug: "business" });
  const now = new Date();
  const [product] = await db
    .insert(products)
    .values({
      name: "Handcheck shoe",
      price: "10",
      stock: 2,
      status: "active",
      category: "shoes",
      sku: `handcheck-${owner.store.id}`,
      user_id: owner.user.id,
      store_id: owner.store.id,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  const payload = {
    customer: {
      name: "Handcheck Customer",
      phone: "01711111111",
      address: "Handcheck road, Dhaka",
    },
    items: [{ productId: product!.id, quantity: 2 }],
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
    const reason = (rejected[0] as PromiseRejectedResult).reason as Error & {
      statusCode?: number;
    };
    assert.equal(reason.statusCode, 409);
    const reloaded = await db.query.products.findFirst({
      where: eq(products.id, product!.id),
    });
    assert.equal(reloaded!.stock, 0);
  } finally {
    await removeOwner(owner);
  }
});

test.after(async () => {
  await pool.end();
});
