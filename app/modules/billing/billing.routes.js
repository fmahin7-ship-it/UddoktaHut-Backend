import express from "express";
import { validate } from "../../middleware/validateMiddleware.js";
import { authenticateUser } from "../../middleware/authMiddleware.js";
import { checkoutSchema } from "./billing.schema.js";
import { createCheckout } from "./billing.controller.js";

const billingRoutes = express.Router();

billingRoutes.post(
  "/checkout",
  authenticateUser,
  validate(checkoutSchema),
  createCheckout
);

export { billingRoutes };
