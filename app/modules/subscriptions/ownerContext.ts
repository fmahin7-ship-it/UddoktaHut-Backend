import { and, eq } from "drizzle-orm";
import { createAppError } from "../../lib/appError.ts";
import { SUBSCRIPTION_ERROR_CODES } from "../../constants/plans.ts";
import { resolvePlanEntitlements } from "./entitlements.ts";
import {
  buildInactiveSubscriptionError,
  isSubscriptionActive,
} from "./subscriptionValidity.ts";
import { db } from "../../db/client.ts";
import { stores } from "../../db/schema/index.ts";

const loadStoreWithSubscription = async ({
  userId,
  storeName,
}: {
  userId?: number;
  storeName?: string;
}) => {
  const store = await db.query.stores.findFirst({
    where: userId
      ? eq(stores.user_id, userId)
      : eq(stores.store_name, storeName!),
    with: {
      subscription: { with: { plan: true } },
    },
  });

  if (!store) return null;

  const subscription = store.subscription ?? null;
  const plan = subscription?.plan ?? null;
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

export type StoreSubscriptionContext = NonNullable<
  Awaited<ReturnType<typeof loadStoreWithSubscription>>
>;

export type OwnerStoreContext = StoreSubscriptionContext;

const loadOwnerStoreContext = async (
  userId: number
): Promise<OwnerStoreContext> => {
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

const assertActiveSubscription = (
  context: StoreSubscriptionContext,
  { isPublicRoute = false }: { isPublicRoute?: boolean } = {}
) => {
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
