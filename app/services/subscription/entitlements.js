import { PLAN_SLUGS } from "../../constants/plans.js";

const DEFAULT_ENTITLEMENTS = Object.freeze({
  maxProducts: 0,
  includesAi: false,
  aiTokenLimitMonthly: 0,
  planSlug: null,
  planName: null,
});

const PLAN_ENTITLEMENTS = Object.freeze({
  [PLAN_SLUGS.TRIAL]: {
    maxProducts: 20,
    includesAi: false,
    aiTokenLimitMonthly: 0,
  },
  [PLAN_SLUGS.BASIC]: {
    maxProducts: 300,
    includesAi: false,
    aiTokenLimitMonthly: 0,
  },
  [PLAN_SLUGS.PRO]: {
    maxProducts: 700,
    includesAi: true,
    aiTokenLimitMonthly: 10000,
  },
  [PLAN_SLUGS.BUSINESS]: {
    maxProducts: 2000,
    includesAi: true,
    aiTokenLimitMonthly: 50000,
  },
});

const resolvePlanEntitlements = (plan) => {
  if (!plan) return { ...DEFAULT_ENTITLEMENTS };

  const slug = plan.slug;
  const fallback = PLAN_ENTITLEMENTS[slug] ?? DEFAULT_ENTITLEMENTS;

  return {
    planSlug: slug ?? null,
    planName: plan.name ?? null,
    maxProducts: plan.max_products ?? fallback.maxProducts,
    includesAi: plan.includes_ai ?? fallback.includesAi,
    aiTokenLimitMonthly:
      plan.ai_token_limit_monthly ?? fallback.aiTokenLimitMonthly,
  };
};

export { resolvePlanEntitlements, PLAN_ENTITLEMENTS, DEFAULT_ENTITLEMENTS };
