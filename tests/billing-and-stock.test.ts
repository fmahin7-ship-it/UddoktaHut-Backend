import assert from "node:assert/strict";
import { mock, test } from "node:test";
import bcrypt from "bcrypt";
import { eq, inArray, like } from "drizzle-orm";
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

const periodEndUnix = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;

const fakeSubscription = {
  id: "sub_test_handcheck",
  cancel_at_period_end: false,
  current_period_end: periodEndUnix,
  items: { data: [{ price: { id: env.STRIPE_PRICE_PRO } }] },
};

const fakeCheckoutSession = {
  id: "cs_test_confirm",
  mode: "subscription",
  status: "complete",
  payment_status: "paid",
  client_reference_id: "",
  customer: "cus_test_handcheck",
  subscription: "sub_test_handcheck",
  metadata: {} as Record<string, string>,
};

mock.module("../app/modules/billing/providers/stripe.ts", {
  namedExports: {
    getStripe: () => ({
      subscriptions: {
        retrieve: async (id: string) => ({ ...fakeSubscription, id }),
      },
      checkout: {
        sessions: {
          retrieve: async () => ({
            ...fakeCheckoutSession,
            client_reference_id: fakeCheckoutSession.client_reference_id,
            metadata: { ...fakeCheckoutSession.metadata },
          }),
        },
      },
      billingPortal: {
        sessions: {
          create: async () => ({
            url: "https://billing.stripe.com/p/session/test",
          }),
        },
      },
    }),
  },
});

const {
  applyStripeEvent,
  confirmCheckoutSession,
  createBillingPortalSession,
  createCheckoutSession,
} = await import("../app/modules/billing/billing.service.ts");

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

const wipeEvents = async (...eventIds: string[]) => {
  for (const eventId of eventIds) {
    await db
      .delete(billingWebhookEvents)
      .where(eq(billingWebhookEvents.event_id, eventId));
  }
  await db
    .delete(billingWebhookEvents)
    .where(like(billingWebhookEvents.event_id, "confirm_%"));
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
    await wipeEvents(eventId);
    await removeOwner(owner);
  }
});

test("confirmCheckoutSession activates Pro from a paid Stripe session", async () => {
  const owner = await createOwner({ country: "AU", planSlug: "trial" });
  fakeCheckoutSession.client_reference_id = String(owner.store.id);
  fakeCheckoutSession.metadata = {
    store_id: String(owner.store.id),
    user_id: String(owner.user.id),
    plan_slug: "pro",
  };
  fakeCheckoutSession.id = `cs_test_confirm_${owner.store.id}`;
  try {
    const first = await confirmCheckoutSession({
      user: owner.user,
      sessionId: fakeCheckoutSession.id,
    });
    assert.equal(first.ok, true);
    assert.equal(first.alreadyActive, false);

    const updated = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.store_id, owner.store.id),
    });
    assert.equal(updated!.status, "active");
    assert.equal(updated!.stripe_subscription_id, "sub_test_handcheck");

    const second = await confirmCheckoutSession({
      user: owner.user,
      sessionId: fakeCheckoutSession.id,
    });
    assert.equal(second.alreadyActive, true);
  } finally {
    await wipeEvents(`confirm_${fakeCheckoutSession.id}`);
    await removeOwner(owner);
  }
});

test("invoice.paid extends the subscription period", async () => {
  const owner = await createOwner({
    country: "AU",
    planSlug: "pro",
    subscriptionFields: {
      status: "active",
      billing_provider: "stripe",
      stripe_customer_id: "cus_renew",
      stripe_subscription_id: "sub_renew",
      end_date: new Date(Date.now() + 86400000),
    },
  });
  const eventId = `evt_invoice_paid_${owner.store.id}`;
  try {
    await applyStripeEvent({
      id: eventId,
      type: "invoice.paid",
      data: { object: { subscription: "sub_renew" } },
    });
    const updated = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.store_id, owner.store.id),
    });
    assert.equal(updated!.status, "active");
    assert.ok(
      updated!.end_date!.getTime() > Date.now() + 7 * 86400000,
      "end_date should move near the mocked 30-day period"
    );
  } finally {
    await wipeEvents(eventId);
    await removeOwner(owner);
  }
});

test("invoice.paid reads subscription id from newer Stripe parent path", async () => {
  const owner = await createOwner({
    country: "AU",
    planSlug: "pro",
    subscriptionFields: {
      status: "past_due",
      billing_provider: "stripe",
      stripe_customer_id: "cus_nested",
      stripe_subscription_id: "sub_nested",
      end_date: new Date(Date.now() + 86400000),
    },
  });
  const eventId = `evt_invoice_nested_${owner.store.id}`;
  try {
    await applyStripeEvent({
      id: eventId,
      type: "invoice.paid",
      data: {
        object: {
          id: "in_nested",
          parent: {
            subscription_details: { subscription: "sub_nested" },
          },
        },
      },
    });
    const updated = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.store_id, owner.store.id),
    });
    assert.equal(updated!.status, "active");
    const event = await db.query.billingWebhookEvents.findFirst({
      where: eq(billingWebhookEvents.event_id, eventId),
    });
    const payload = event?.payload_json as { subscription?: string };
    assert.equal(payload?.subscription, "sub_nested");
    assert.equal(
      (event?.payload_json as { lines?: unknown })?.lines,
      undefined,
      "full invoice blob should not be stored"
    );
  } finally {
    await wipeEvents(eventId);
    await removeOwner(owner);
  }
});

test("invoice.payment_failed marks the subscription past_due", async () => {
  const owner = await createOwner({
    country: "AU",
    planSlug: "pro",
    subscriptionFields: {
      status: "active",
      billing_provider: "stripe",
      stripe_customer_id: "cus_fail",
      stripe_subscription_id: "sub_fail",
      end_date: new Date(Date.now() + 10 * 86400000),
    },
  });
  const eventId = `evt_invoice_fail_${owner.store.id}`;
  try {
    await applyStripeEvent({
      id: eventId,
      type: "invoice.payment_failed",
      data: { object: { subscription: "sub_fail" } },
    });
    const updated = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.store_id, owner.store.id),
    });
    assert.equal(updated!.status, "past_due");
  } finally {
    await wipeEvents(eventId);
    await removeOwner(owner);
  }
});

test("customer.subscription.updated syncs cancel flag and Stripe status", async () => {
  const owner = await createOwner({
    country: "AU",
    planSlug: "pro",
    subscriptionFields: {
      status: "active",
      billing_provider: "stripe",
      stripe_customer_id: "cus_cancel",
      stripe_subscription_id: "sub_cancel",
      end_date: new Date(Date.now() + 10 * 86400000),
      cancel_at_period_end: false,
    },
  });
  const eventId = `evt_sub_updated_${owner.store.id}`;
  try {
    await applyStripeEvent({
      id: eventId,
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_cancel",
          status: "past_due",
          cancel_at_period_end: true,
          current_period_end: periodEndUnix,
          items: { data: [{ price: { id: env.STRIPE_PRICE_PRO } }] },
        },
      },
    });
    const updated = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.store_id, owner.store.id),
    });
    assert.equal(updated!.cancel_at_period_end, true);
    assert.equal(updated!.is_auto_renew, false);
    assert.equal(updated!.status, "past_due");
  } finally {
    await wipeEvents(eventId);
    await removeOwner(owner);
  }
});

test("customer.subscription.deleted ends local access", async () => {
  const owner = await createOwner({
    country: "AU",
    planSlug: "pro",
    subscriptionFields: {
      status: "active",
      billing_provider: "stripe",
      stripe_customer_id: "cus_del",
      stripe_subscription_id: "sub_del",
      end_date: new Date(Date.now() + 10 * 86400000),
    },
  });
  const eventId = `evt_sub_deleted_${owner.store.id}`;
  try {
    await applyStripeEvent({
      id: eventId,
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_del" } },
    });
    const updated = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.store_id, owner.store.id),
    });
    assert.equal(updated!.status, "canceled");
    assert.ok(updated!.end_date! <= new Date());
  } finally {
    await wipeEvents(eventId);
    await removeOwner(owner);
  }
});

test("billing portal opens for a Stripe customer", async () => {
  const owner = await createOwner({
    country: "AU",
    planSlug: "pro",
    subscriptionFields: {
      status: "active",
      billing_provider: "stripe",
      stripe_customer_id: "cus_portal",
      stripe_subscription_id: "sub_portal",
      end_date: new Date(Date.now() + 10 * 86400000),
    },
  });
  try {
    const { url } = await createBillingPortalSession(owner.user);
    assert.match(url, /billing\.stripe\.com/);
  } finally {
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
