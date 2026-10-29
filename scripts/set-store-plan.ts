/**
 * Assign a subscription plan to a merchant store (dev / admin — no payment).
 */
import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { connectDatabase, pool } from "../app/db/client.ts";
import { db } from "../app/db/client.ts";
import { plans, stores, subscriptions, users } from "../app/db/schema/index.ts";
import { PLAN_SLUGS } from "../app/constants/plans.ts";

dotenv.config();

const VALID_PLANS = new Set(Object.values(PLAN_SLUGS));

function parseArgs(argv: string[]) {
  const out: {
    email: string | null;
    store: string | null;
    plan: string;
    days: number;
  } = { email: null, store: null, plan: "pro", days: 30 };
  for (const arg of argv) {
    if (arg.startsWith("--email=")) out.email = arg.slice(8).trim();
    else if (arg.startsWith("--store=")) out.store = arg.slice(8).trim();
    else if (arg.startsWith("--plan="))
      out.plan = arg.slice(7).trim().toLowerCase();
    else if (arg.startsWith("--days="))
      out.days = Math.max(1, parseInt(arg.slice(7), 10) || 30);
  }
  if (process.env.STORE_EMAIL) out.email = process.env.STORE_EMAIL;
  if (process.env.STORE_NAME) out.store = process.env.STORE_NAME;
  if (process.env.PLAN) out.plan = process.env.PLAN.toLowerCase();
  return out;
}

async function resolveStore({
  email,
  storeName,
}: {
  email: string | null;
  storeName: string | null;
}) {
  if (!email && !storeName) {
    throw new Error(
      "Provide --email=... or --store=... (or STORE_EMAIL / STORE_NAME env)"
    );
  }

  if (email) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
      with: { store: true },
    });
    if (!user?.store) throw new Error(`No store found for email: ${email}`);
    return { user, store: user.store };
  }

  const store = await db.query.stores.findFirst({
    where: eq(stores.store_name, storeName!),
  });
  if (!store) throw new Error(`Store not found: ${storeName}`);
  const user = await db.query.users.findFirst({
    where: eq(users.id, store.user_id),
  });
  return { user, store };
}

async function assignPlan({
  store,
  planSlug,
  days,
}: {
  store: { id: number; store_name: string };
  planSlug: string;
  days: number;
}) {
  if (!VALID_PLANS.has(planSlug as (typeof PLAN_SLUGS)[keyof typeof PLAN_SLUGS])) {
    throw new Error(
      `Invalid plan "${planSlug}". Use: ${[...VALID_PLANS].join(", ")}`
    );
  }

  const plan = await db.query.plans.findFirst({
    where: eq(plans.slug, planSlug),
  });
  if (!plan) {
    throw new Error(`Plan "${planSlug}" not in DB. Run: npm run db:sync-dev`);
  }

  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.store_id, store.id),
  });
  if (!subscription) {
    throw new Error(`No subscription row for store id ${store.id}`);
  }

  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + days);

  if (planSlug === PLAN_SLUGS.TRIAL) {
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 7);
    await db
      .update(subscriptions)
      .set({
        plan_id: plan.id,
        status: "trialing",
        trial_ends_at: trialEnd,
        end_date: trialEnd,
        is_auto_renew: false,
      })
      .where(eq(subscriptions.id, subscription.id));
    return { subscription, plan, endsAt: trialEnd, status: "trialing" };
  }

  await db
    .update(subscriptions)
    .set({
      plan_id: plan.id,
      status: "active",
      trial_ends_at: null,
      end_date: end,
      is_auto_renew: false,
    })
    .where(eq(subscriptions.id, subscription.id));

  return { subscription, plan, endsAt: end, status: "active" };
}

async function main() {
  const { email, store, plan, days } = parseArgs(process.argv.slice(2));

  try {
    await connectDatabase();
    const { user, store: storeRow } = await resolveStore({
      email,
      storeName: store,
    });
    const result = await assignPlan({
      store: storeRow,
      planSlug: plan,
      days,
    });

    console.log("✅ Plan updated");
    console.log({
      userId: user?.id,
      email: user?.email,
      storeName: storeRow.store_name,
      plan: result.plan.slug,
      planName: result.plan.name,
      status: result.status,
      maxProducts: result.plan.max_products,
      includesAi: result.plan.includes_ai,
      aiTokenLimitMonthly: result.plan.ai_token_limit_monthly,
      validUntil: result.endsAt.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌", message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
