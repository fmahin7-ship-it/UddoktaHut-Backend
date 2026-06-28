import { Store, Subscription, Plan } from "../../models/RootModel.js";
import { createAppError } from "../../lib/appError.js";
import { SUBSCRIPTION_ERROR_CODES } from "../../constants/plans.js";
import { resolvePlanEntitlements } from "./entitlements.js";
import {
  buildInactiveSubscriptionError,
  isSubscriptionActive,
} from "./subscriptionValidity.js";

const loadStoreWithSubscription = async ({ userId, storeName }) => {
  const store = await Store.findOne({
    where: userId ? { user_id: userId } : { store_name: storeName },
    include: [
      {
        model: Subscription,
        required: false,
        include: [{ model: Plan, required: false }],
      },
    ],
  });

  if (!store) return null;

  const subscription = store.Subscription ?? null;
  const plan = subscription?.Plan ?? null;
  const entitlements = resolvePlanEntitlements(plan);
  const isActive = isSubscriptionActive(subscription);

  return {
    store,
    subscription,
    plan,
    entitlements,
    isActive,
  };
};

const loadOwnerStoreContext = async (userId) => {
  const context = await loadStoreWithSubscription({ userId });

  if (!context) {
    throw createAppError(
      "No store found",
      403,
      SUBSCRIPTION_ERROR_CODES.SUBSCRIPTION_REQUIRED
    );
  }

  return context;
};

const assertActiveSubscription = (context, { isPublicRoute = false } = {}) => {
  if (!context.store) {
    throw createAppError(
      isPublicRoute ? "Store not found" : "No store found",
      isPublicRoute ? 404 : 403,
      SUBSCRIPTION_ERROR_CODES.SUBSCRIPTION_REQUIRED
    );
  }

  if (!context.isActive) {
    throw buildInactiveSubscriptionError(context.subscription, isPublicRoute);
  }
};

export {
  loadStoreWithSubscription,
  loadOwnerStoreContext,
  assertActiveSubscription,
};
