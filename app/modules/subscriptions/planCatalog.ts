import { eq } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { plans } from "../../db/schema/index.ts";
import { PLAN_SLUGS } from "../../constants/plans.ts";

const planSlugCache = new Map<string, number>();

const getPlanIdBySlug = async (slug: string): Promise<number> => {
  if (planSlugCache.has(slug)) return planSlugCache.get(slug)!;

  const plan = await db.query.plans.findFirst({
    where: eq(plans.slug, slug),
    columns: { id: true },
  });

  if (!plan) {
    throw new Error(`Plan not found for slug: ${slug}. Run migrations.`);
  }

  planSlugCache.set(slug, plan.id);
  return plan.id;
};

const getTrialPlanId = () => getPlanIdBySlug(PLAN_SLUGS.TRIAL);

export { getPlanIdBySlug, getTrialPlanId, PLAN_SLUGS };
