import express from "express";
import {
  checkoutSchema,
  subscribedStoreSchema,
  subscriptionSchema,
} from "../validations/subscriptionSchema.js";
import { validate } from "../middleware/validateMiddleware.js";
import { authenticateUser } from "../middleware/authMiddleware.js";
import {
  createCheckout,
  subscribedStore,
  subscriptionStatus,
} from "../controllers/subscriptionController.js";

const subscriptionRoutes = express.Router();

subscriptionRoutes.post(
  "/checkout",
  authenticateUser,
  validate(checkoutSchema),
  createCheckout
);
subscriptionRoutes.post(
  "/status",
  validate(subscriptionSchema),
  subscriptionStatus
);
subscriptionRoutes.get(
  "/store/:storeName",
  validate(subscribedStoreSchema, "params"),
  subscribedStore
);

export { subscriptionRoutes };
