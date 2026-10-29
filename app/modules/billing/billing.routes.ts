import express from "express";
import { validate } from "../../middleware/validateMiddleware.ts";
import { authenticateUser } from "../../middleware/authMiddleware.ts";
import { checkoutSchema } from "./billing.schema.ts";
import { createCheckout } from "./billing.controller.ts";

const billingRoutes = express.Router();

billingRoutes.post(
  "/checkout",
  authenticateUser,
  validate(checkoutSchema),
  createCheckout
);

export { billingRoutes };
