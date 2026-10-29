import type { Response } from "express";
import {
  loadOwnerStoreContext,
  loadStoreWithSubscription,
  assertActiveSubscription,
} from "../modules/subscriptions/ownerContext.ts";
import { createAppError } from "../lib/appError.ts";
import { requireUser } from "../lib/requireUser.ts";
import { SUBSCRIPTION_ERROR_CODES } from "../constants/plans.ts";
import { assertCanCreateProduct } from "../modules/subscriptions/productLimitService.ts";
import { assertCanUseAi } from "../modules/subscriptions/aiUsageService.ts";
import type { AsyncRoute } from "../types/http.ts";

type ContextError = Error & {
  statusCode?: number;
  code?: string;
  details?: unknown;
};

const sendContextError = (res: Response, error: ContextError) =>
  res.status(error.statusCode || 500).json({
    success: false,
    error: error.code || "RequestError",
    message: error.message,
    ...(error.details ? { details: error.details } : {}),
  });

const attachOwnerStoreContext: AsyncRoute = async (req, res, next) => {
  try {
    const user = requireUser(req);
    req.ownerStoreContext = await loadOwnerStoreContext(user.id);
    next();
  } catch (error) {
    sendContextError(res, error as ContextError);
  }
};

const requireActiveOwnerSubscription: AsyncRoute = async (req, res, next) => {
  try {
    const user = requireUser(req);
    if (!req.ownerStoreContext) {
      req.ownerStoreContext = await loadOwnerStoreContext(user.id);
    }

    assertActiveSubscription(req.ownerStoreContext);
    next();
  } catch (error) {
    sendContextError(res, error as ContextError);
  }
};

const requireProductCreateSlot: AsyncRoute = async (req, res, next) => {
  try {
    const user = requireUser(req);
    if (!req.ownerStoreContext) {
      req.ownerStoreContext = await loadOwnerStoreContext(user.id);
    }

    assertActiveSubscription(req.ownerStoreContext);

    const { store, entitlements } = req.ownerStoreContext;
    req.productUsage = await assertCanCreateProduct(
      store.id,
      Number(entitlements.maxProducts ?? 0)
    );
    next();
  } catch (error) {
    sendContextError(res, error as ContextError);
  }
};

const requireAiEntitlement: AsyncRoute = async (req, res, next) => {
  try {
    const user = requireUser(req);
    if (!req.ownerStoreContext) {
      req.ownerStoreContext = await loadOwnerStoreContext(user.id);
    }

    assertActiveSubscription(req.ownerStoreContext);

    const { store, entitlements } = req.ownerStoreContext;
    const question =
      typeof req.body?.question === "string" ? req.body.question : "";

    req.aiUsage = await assertCanUseAi({
      storeId: store.id,
      includesAi: Boolean(entitlements.includesAi),
      tokenLimit: Number(entitlements.aiTokenLimitMonthly ?? 0),
      question,
    });

    next();
  } catch (error) {
    sendContextError(res, error as ContextError);
  }
};

const requireActiveStoreSubscription: AsyncRoute = async (req, res, next) => {
  try {
    const storeName = req.params.storeName;
    const context = await loadStoreWithSubscription({ storeName });

    if (!context) {
      throw createAppError(
        "Store not found",
        404,
        SUBSCRIPTION_ERROR_CODES.SUBSCRIPTION_REQUIRED
      );
    }

    assertActiveSubscription(context, { isPublicRoute: true });
    next();
  } catch (error) {
    sendContextError(res, error as ContextError);
  }
};

export {
  attachOwnerStoreContext,
  requireActiveOwnerSubscription,
  requireProductCreateSlot,
  requireAiEntitlement,
  requireActiveStoreSubscription,
};
