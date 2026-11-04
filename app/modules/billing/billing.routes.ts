import express from "express";
import { validate } from "../../middleware/validateMiddleware.ts";
import { authenticateUser } from "../../middleware/authMiddleware.ts";
import {
  changePlanSchema,
  checkoutSchema,
  confirmCheckoutSchema,
} from "./billing.schema.ts";
import {
  cancelPlanChange,
  changeSubscriptionPlan,
  confirmCheckout,
  createCheckout,
  createPortal,
} from "./billing.controller.ts";

const billingRoutes = express.Router();

billingRoutes.post(
  "/checkout",
  authenticateUser,
  validate(checkoutSchema),
  createCheckout
);

billingRoutes.post(
  "/checkout/confirm",
  authenticateUser,
  validate(confirmCheckoutSchema),
  confirmCheckout
);

billingRoutes.post(
  "/change-plan",
  authenticateUser,
  validate(changePlanSchema),
  changeSubscriptionPlan
);

billingRoutes.post(
  "/change-plan/cancel",
  authenticateUser,
  cancelPlanChange
);

billingRoutes.post("/billing-portal", authenticateUser, createPortal);

export { billingRoutes };
