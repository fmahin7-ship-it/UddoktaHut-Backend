import express from "express";
import { validate } from "../../middleware/validateMiddleware.ts";
import { authenticateUser } from "../../middleware/authMiddleware.ts";
import { checkoutSchema, confirmCheckoutSchema } from "./billing.schema.ts";
import {
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

billingRoutes.post("/billing-portal", authenticateUser, createPortal);

export { billingRoutes };
