import { PLAN_SLUGS } from "../../constants/plans.ts";

type PlanRow = {
  slug?: string | null;
  name?: string | null;
  max_products?: number | null;
  includes_ai?: boolean | null;
  ai_token_limit_monthly?: number | null;
} | null;

const DEFAULT_ENTITLEMENTS = Object.freeze({
  maxProducts: 0,
  includesAi: false,
  aiTokenLimitMonthly: 0,
  planSlug: null as string | null,
  planName: null as string | null,
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
    aiTokenLimitMonthly: 200000,
  },
  [PLAN_SLUGS.BUSINESS]: {
    maxProducts: 2000,
    includesAi: true,
    aiTokenLimitMonthly: 1000000,
  },
} as const);

type PlanSlug = keyof typeof PLAN_ENTITLEMENTS;

const resolvePlanEntitlements = (plan: PlanRow) => {
  if (!plan) return { ...DEFAULT_ENTITLEMENTS };

  const slug = plan.slug ?? null;
  const fallback =
    slug && slug in PLAN_ENTITLEMENTS
      ? PLAN_ENTITLEMENTS[slug as PlanSlug]
      : DEFAULT_ENTITLEMENTS;

  return {
    planSlug: slug,
    planName: plan.name ?? null,
    maxProducts: plan.max_products ?? fallback.maxProducts,
    includesAi: plan.includes_ai ?? fallback.includesAi,
    aiTokenLimitMonthly:
      plan.ai_token_limit_monthly ?? fallback.aiTokenLimitMonthly,
  };
};

export { resolvePlanEntitlements, PLAN_ENTITLEMENTS, DEFAULT_ENTITLEMENTS };
