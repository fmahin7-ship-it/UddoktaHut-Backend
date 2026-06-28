import { throwError } from "../lib/throwError.js";
import {
  User,
  Role,
  UserRole,
  Store,
  Plan,
  Subscription,
} from "../models/RootModel.js";
import { isSubscriptionActive } from "./subscription/subscriptionValidity.js";
import { resolvePlanEntitlements } from "./subscription/entitlements.js";
import { getProductUsage } from "./subscription/productLimitService.js";
import { getAiUsageSummary } from "./subscription/aiUsageService.js";

const getSubscriptionStatus = async ({ userId }) => {
  const user = await User.findOne({
    where: { id: userId },
    include: [
      {
        model: Role,
        through: { model: UserRole, attributes: ["onboarded"] },
        attributes: ["id", "role_name"],
      },
      {
        model: Store,
      },
    ],
  });

  if (!user) throwError("Not authorized", 401);

  const baseUser = {
    name: user.name,
    email: user.email,
    phoneNumber: user.phone_number,
    onboarded: user.Roles[0]?.user_roles?.onboarded,
    role: user.Roles[0]?.user_roles?.role_id,
  };

  if (!user.Store) {
    return { user: baseUser };
  }

  const subscription = await Subscription.findOne({
    where: { store_id: user.Store.id },
    include: [Plan],
  });

  if (!subscription) throw new Error("No subscription found");

  const entitlements = resolvePlanEntitlements(subscription.Plan);
  const isActive = isSubscriptionActive(subscription);
  const productUsage = await getProductUsage(
    user.Store.id,
    entitlements.maxProducts
  );
  const aiUsage = entitlements.includesAi
    ? await getAiUsageSummary(user.Store.id, entitlements.aiTokenLimitMonthly)
    : null;

  const userData = {
    ...baseUser,
    template_name: user.Store.template_name,
    storeName: user.Store.store_name,
    storeUrl: user.Store.store_url,
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
  };

  return { user: userData };
};

const getSubscribedStore = async ({ storeName }) => {
  const store = await Store.findOne({ where: { store_name: storeName } });

  if (!store) return { storeData: null };

  const subscription = await Subscription.findOne({
    where: { store_id: store.id },
    include: [Plan],
  });

  if (!subscription) return { store: null };

  const isActive = isSubscriptionActive(subscription);
  const entitlements = resolvePlanEntitlements(subscription.Plan);

  const payload = {
    ...store.toJSON(),
    isActive,
    planSlug: entitlements.planSlug,
    planName: entitlements.planName,
  };
  return { storeData: payload };
};

export { getSubscriptionStatus, getSubscribedStore };
