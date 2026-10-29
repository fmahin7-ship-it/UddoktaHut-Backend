import assert from "node:assert/strict";
import { test } from "node:test";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "../app/db/client.ts";
import { plans, stores, subscriptions, users } from "../app/db/schema/index.ts";
import { HANDLERS } from "../app/modules/ai/tools/registry.ts";

/**
 * Runs every AI tool once. Creates its own store so CI never skips
 * (this guards the :name / ::int SQL binder regression).
 */
test("every AI tool runs without SQL binder errors", async () => {
  const plan = await db.query.plans.findFirst({
    where: eq(plans.slug, "trial"),
  });
  assert.ok(plan, "Plan 'trial' missing — run npm run db:prepare-test");

  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const storeName = `ai-smoke-${stamp}`;
  const password = bcrypt.hashSync("AiSmoke123", 10);

  const [user] = await db
    .insert(users)
    .values({
      email: `ai-smoke-${stamp}@example.com`,
      name: "AI Smoke",
      password,
    })
    .returning();
  assert.ok(user);

  const [store] = await db
    .insert(stores)
    .values({
      user_id: user.id,
      store_name: storeName,
      store_url: `${storeName}.uddoktahut.local`,
      store_type: "retail",
      country: "AU",
    })
    .returning();
  assert.ok(store);

  await db.insert(subscriptions).values({
    store_id: store.id,
    status: "trialing",
    start_date: new Date(),
    trial_ends_at: new Date(Date.now() + 7 * 86400000),
    end_date: new Date(Date.now() + 7 * 86400000),
    is_auto_renew: false,
    plan_id: plan.id,
    cancel_at_period_end: false,
  });

  const failures: string[] = [];
  try {
    for (const [name, handler] of Object.entries(HANDLERS)) {
      try {
        await handler({ storeName });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failures.push(`${name}: ${message}`);
      }
    }

    assert.deepEqual(
      failures,
      [],
      `AI tools failed:\n${failures.join("\n")}`
    );
  } finally {
    await db.delete(subscriptions).where(eq(subscriptions.store_id, store.id));
    await db.delete(stores).where(eq(stores.id, store.id));
    await db.delete(users).where(eq(users.id, user.id));
  }
});
