import { and, asc, eq } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { planPrices, plans } from "../../db/schema/index.ts";
import { MARKETS } from "../../constants/markets.ts";
import { resolvePlanEntitlements } from "../subscriptions/entitlements.ts";

const getPublicPlans = async (market: keyof typeof MARKETS) => {
  const prices = await db
    .select({ price: planPrices, plan: plans })
    .from(planPrices)
    .innerJoin(plans, eq(planPrices.plan_id, plans.id))
    .where(and(eq(planPrices.market, market), eq(planPrices.is_active, true)))
    .orderBy(asc(planPrices.amount));

  const mapped = prices.map(({ price, plan }) => {
    const entitlements = resolvePlanEntitlements(plan);
    return {
      slug: entitlements.planSlug,
      name: entitlements.planName,
      billingCycle: plan.billing_cycle,
      amount: price.amount,
      maxProducts: entitlements.maxProducts,
      includesAi: entitlements.includesAi,
      aiTokenLimitMonthly: entitlements.aiTokenLimitMonthly,
    };
  });

  return { market, currency: MARKETS[market].currency, plans: mapped };
};

export { getPublicPlans };
