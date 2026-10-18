import { Plan, PlanPrice } from "../../models/RootModel.js";
import { MARKETS } from "../../constants/markets.js";
import { resolvePlanEntitlements } from "../subscriptions/entitlements.js";

const getPublicPlans = async (market) => {
  const prices = await PlanPrice.findAll({
    where: { market, is_active: true },
    include: [{ model: Plan, required: true }],
    order: [["amount", "ASC"]],
  });

  const plans = prices.map((price) => {
    const entitlements = resolvePlanEntitlements(price.Plan);
    return {
      slug: entitlements.planSlug,
      name: entitlements.planName,
      billingCycle: price.Plan.billing_cycle,
      amount: price.amount,
      maxProducts: entitlements.maxProducts,
      includesAi: entitlements.includesAi,
      aiTokenLimitMonthly: entitlements.aiTokenLimitMonthly,
    };
  });

  return { market, currency: MARKETS[market].currency, plans };
};

export { getPublicPlans };
