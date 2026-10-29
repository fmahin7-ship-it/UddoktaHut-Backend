import { eq } from "drizzle-orm";
import { assertFound } from "../../lib/throwError.ts";
import { db } from "../../db/client.ts";
import { stores, users } from "../../db/schema/index.ts";
import { isSubscriptionActive } from "./subscriptionValidity.ts";
import { resolvePlanEntitlements } from "./entitlements.ts";
import { getProductUsage } from "./productLimitService.ts";
import { getAiUsageSummary } from "./aiUsageService.ts";

const getSubscriptionStatus = async ({ userId }: { userId: number }) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: {
      roleAssignments: { with: { role: true } },
      store: {
        with: {
          subscription: { with: { plan: true } },
        },
      },
    },
  });

  assertFound(user, "Not authorized", 401);

  const baseUser = {
    name: user.name,
    email: user.email,
    phoneNumber: user.phone_number,
    onboarded: user.roleAssignments[0]?.onboarded,
    role: user.roleAssignments[0]?.role_id,
  };

  if (!user.store) {
    return { user: baseUser };
  }

  const subscription = user.store.subscription;
  if (!subscription) throw new Error("No subscription found");

  const entitlements = resolvePlanEntitlements(subscription.plan);
  const isActive = isSubscriptionActive(subscription);
  const productUsage = await getProductUsage(
    user.store.id,
    entitlements.maxProducts
  );
  const aiUsage = entitlements.includesAi
    ? await getAiUsageSummary(user.store.id, entitlements.aiTokenLimitMonthly)
    : null;

  const userData = {
    ...baseUser,
    template_name: user.store.template_name,
    storeName: user.store.store_name,
    storeUrl: user.store.store_url,
    country: user.store.country,
    isActive,
    planSlug: entitlements.planSlug,
    planName: entitlements.planName,
    includesAi: entitlements.includesAi,
    maxProducts: entitlements.maxProducts,
    productCount: productUsage.used,
    productsRemaining: productUsage.remaining,
    aiTokenLimitMonthly: entitlements.aiTokenLimitMonthly,
    aiTokensUsed: aiUsage?.used ?? 0,
    aiTokensRemaining: aiUsage?.remaining ?? 0,
    subscriptionStatus: subscription.status,
    endDate: subscription.end_date,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
  };

  return { user: userData };
};

const getSubscribedStore = async ({ storeName }: { storeName: string }) => {
  const store = await db.query.stores.findFirst({
    where: eq(stores.store_name, storeName),
    with: {
      subscription: { with: { plan: true } },
    },
  });

  if (!store) return { storeData: null };

  const subscription = store.subscription;
  if (!subscription) return { store: null };

  const isActive = isSubscriptionActive(subscription);
  const entitlements = resolvePlanEntitlements(subscription.plan);

  const payload = {
    ...store,
    isActive,
    planSlug: entitlements.planSlug,
    planName: entitlements.planName,
  };
  return { storeData: payload };
};

export { getSubscriptionStatus, getSubscribedStore };
