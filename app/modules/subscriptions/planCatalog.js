import { Plan, Store, Subscription } from "../../models/RootModel.js";
import { PLAN_SLUGS } from "../../constants/plans.js";

const planSlugCache = new Map();

const getPlanIdBySlug = async (slug) => {
  if (planSlugCache.has(slug)) return planSlugCache.get(slug);

  const plan = await Plan.findOne({
    where: { slug },
    attributes: ["id"],
  });

  if (!plan) {
    throw new Error(`Plan not found for slug: ${slug}. Run migrations.`);
  }

  planSlugCache.set(slug, plan.id);
  return plan.id;
};

const getTrialPlanId = () => getPlanIdBySlug(PLAN_SLUGS.TRIAL);

export { getPlanIdBySlug, getTrialPlanId, PLAN_SLUGS };
