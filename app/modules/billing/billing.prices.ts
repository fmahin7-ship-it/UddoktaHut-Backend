import { env } from "../../config/env.ts";
import { PLAN_SLUGS } from "../../constants/plans.ts";
import { marketFromCountry } from "../../constants/markets.ts";
import { createAppError } from "../../lib/appError.ts";
import { stripeNotConfiguredError } from "./billing.errors.ts";

/** Paid AU plans that use Stripe Checkout / change-plan. */
const AU_CARD_PLAN_SLUGS = [PLAN_SLUGS.PRO, PLAN_SLUGS.BUSINESS] as const;

type AuCardPlanSlug = (typeof AU_CARD_PLAN_SLUGS)[number];

const isAuCardPlanSlug = (slug: string): slug is AuCardPlanSlug =>
  (AU_CARD_PLAN_SLUGS as readonly string[]).includes(slug);

const checkoutUnavailable = (message: string) =>
  createAppError(message, 400, "CHECKOUT_UNAVAILABLE");

/** Stripe price configured for a plan. Empty until that plan is billed by card. */
const configuredPriceId = (planSlug: string): string => {
  if (planSlug === PLAN_SLUGS.PRO) return env.STRIPE_PRICE_PRO;
  if (planSlug === PLAN_SLUGS.BUSINESS) return env.STRIPE_PRICE_BUSINESS;
  return "";
};

/** Map a Stripe price id back to our plan slug. */
const planSlugFromPriceId = (priceId: string | null | undefined): string | null => {
  if (!priceId) return null;
  if (priceId === env.STRIPE_PRICE_PRO) return PLAN_SLUGS.PRO;
  if (priceId === env.STRIPE_PRICE_BUSINESS) return PLAN_SLUGS.BUSINESS;
  return null;
};

const planRank = (slug: string): number => {
  if (slug === PLAN_SLUGS.BUSINESS) return 2;
  if (slug === PLAN_SLUGS.PRO) return 1;
  return 0;
};

/** Price for this plan in the store's market. Pro + Business in Australia only. */
const priceIdForPlan = (planSlug: string, country: string): string => {
  const market = marketFromCountry(country);
  if (!isAuCardPlanSlug(planSlug) || market !== "AU") {
    throw checkoutUnavailable(
      "Card billing is only available for Australian Pro and Business plans right now."
    );
  }
  const priceId = configuredPriceId(planSlug);
  if (!priceId.startsWith("price_")) {
    throw stripeNotConfiguredError();
  }
  return priceId;
};

export {
  AU_CARD_PLAN_SLUGS,
  configuredPriceId,
  isAuCardPlanSlug,
  planRank,
  planSlugFromPriceId,
  priceIdForPlan,
};
export type { AuCardPlanSlug };
