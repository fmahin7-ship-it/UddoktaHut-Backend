/**
 * Assign a subscription plan to a merchant store (dev / admin — no payment).
 *
 * Usage:
 *   npm run set-store-plan -- --email=user@example.com --plan=pro
 *   npm run set-store-plan -- --store=my-shop --plan=business
 *   npm run set-store-plan -- --email=user@example.com --plan=pro --days=30
 *
 * Plans: trial | basic | pro | business
 *
 * Requires: npm run migrate (plans table seeded)
 */
import dotenv from "dotenv";
import { sequelize } from "../app/config/database.js";
import { User, Store, Subscription, Plan } from "../app/models/RootModel.js";
import { PLAN_SLUGS } from "../app/constants/plans.js";

dotenv.config();

const VALID_PLANS = new Set(Object.values(PLAN_SLUGS));

function parseArgs(argv) {
  const out = { email: null, store: null, plan: "pro", days: 30 };
  for (const arg of argv) {
    if (arg.startsWith("--email=")) out.email = arg.slice(8).trim();
    else if (arg.startsWith("--store=")) out.store = arg.slice(8).trim();
    else if (arg.startsWith("--plan=")) out.plan = arg.slice(7).trim().toLowerCase();
    else if (arg.startsWith("--days=")) out.days = Math.max(1, parseInt(arg.slice(7), 10) || 30);
  }
  if (process.env.STORE_EMAIL) out.email = process.env.STORE_EMAIL;
  if (process.env.STORE_NAME) out.store = process.env.STORE_NAME;
  if (process.env.PLAN) out.plan = process.env.PLAN.toLowerCase();
  return out;
}

async function resolveStore({ email, storeName }) {
  if (!email && !storeName) {
    throw new Error("Provide --email=... or --store=... (or STORE_EMAIL / STORE_NAME env)");
  }

  if (email) {
    const user = await User.findOne({
      where: { email },
      include: [{ model: Store, required: true }],
    });
    if (!user?.Store) throw new Error(`No store found for email: ${email}`);
    return { user, store: user.Store };
  }

  const store = await Store.findOne({ where: { store_name: storeName } });
  if (!store) throw new Error(`Store not found: ${storeName}`);
  const user = await User.findByPk(store.user_id);
  return { user, store };
}

async function assignPlan({ store, planSlug, days }) {
  if (!VALID_PLANS.has(planSlug)) {
    throw new Error(`Invalid plan "${planSlug}". Use: ${[...VALID_PLANS].join(", ")}`);
  }

  const plan = await Plan.findOne({ where: { slug: planSlug } });
  if (!plan) {
    throw new Error(`Plan "${planSlug}" not in DB. Run: npm run migrate`);
  }

  const subscription = await Subscription.findOne({ where: { store_id: store.id } });
  if (!subscription) {
    throw new Error(`No subscription row for store id ${store.id}`);
  }

  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + days);

  if (planSlug === PLAN_SLUGS.TRIAL) {
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 7);
    await subscription.update({
      plan_id: plan.id,
      status: "trialing",
      trial_ends_at: trialEnd,
      end_date: trialEnd,
      is_auto_renew: false,
    });
    return { subscription, plan, endsAt: trialEnd, status: "trialing" };
  }

  await subscription.update({
    plan_id: plan.id,
    status: "active",
    trial_ends_at: null,
    end_date: end,
    is_auto_renew: false,
  });

  return { subscription, plan, endsAt: end, status: "active" };
}

async function main() {
  const { email, store, plan, days } = parseArgs(process.argv.slice(2));

  try {
    await sequelize.authenticate();
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
    console.error("❌", err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
