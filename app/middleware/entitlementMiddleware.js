import {
  loadOwnerStoreContext,
  loadStoreWithSubscription,
  assertActiveSubscription,
} from "../services/subscription/ownerContext.js";
import { createAppError } from "../lib/appError.js";
import { SUBSCRIPTION_ERROR_CODES } from "../constants/plans.js";
import { assertCanCreateProduct } from "../services/subscription/productLimitService.js";
import {
  assertCanUseAi,
  estimateTokens,
} from "../services/subscription/aiUsageService.js";

const sendContextError = (res, error) =>
  res.status(error.statusCode || 500).json({
    success: false,
    error: error.code || "RequestError",
    message: error.message,
    ...(error.details ? { details: error.details } : {}),
  });

const attachOwnerStoreContext = async (req, res, next) => {
  try {
    req.ownerStoreContext = await loadOwnerStoreContext(req.user.id);
    next();
  } catch (error) {
    sendContextError(res, error);
  }
};

const requireActiveOwnerSubscription = async (req, res, next) => {
  try {
    if (!req.ownerStoreContext) {
      req.ownerStoreContext = await loadOwnerStoreContext(req.user.id);
    }

    assertActiveSubscription(req.ownerStoreContext);
    next();
  } catch (error) {
    sendContextError(res, error);
  }
};

const requireProductCreateSlot = async (req, res, next) => {
  try {
    if (!req.ownerStoreContext) {
      req.ownerStoreContext = await loadOwnerStoreContext(req.user.id);
    }

    assertActiveSubscription(req.ownerStoreContext);

    const { store, entitlements } = req.ownerStoreContext;
    req.productUsage = await assertCanCreateProduct(
      store.id,
      entitlements.maxProducts
    );
    next();
  } catch (error) {
    sendContextError(res, error);
  }
};

const requireAiEntitlement = async (req, res, next) => {
  try {
    if (!req.ownerStoreContext) {
      req.ownerStoreContext = await loadOwnerStoreContext(req.user.id);
    }

    assertActiveSubscription(req.ownerStoreContext);

    const { store, entitlements } = req.ownerStoreContext;
    const question = req.body?.question ?? "";

    req.aiUsage = await assertCanUseAi({
      storeId: store.id,
      includesAi: entitlements.includesAi,
      tokenLimit: entitlements.aiTokenLimitMonthly,
      question,
    });

    req.recordAiUsage = (answerText = "") => {
      const tokens = estimateTokens(`${question}${answerText}`);
      req.aiTokensRecorded = tokens;
      return tokens;
    };

    next();
  } catch (error) {
    sendContextError(res, error);
  }
};

const requireActiveStoreSubscription = async (req, res, next) => {
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
    sendContextError(res, error);
  }
};

export {
  attachOwnerStoreContext,
  requireActiveOwnerSubscription,
  requireProductCreateSlot,
  requireAiEntitlement,
  requireActiveStoreSubscription,
};
