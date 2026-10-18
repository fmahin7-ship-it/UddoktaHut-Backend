import express from "express";
import {
  subscribedStoreSchema,
  subscriptionSchema,
} from "./subscriptions.schema.js";
import { validate } from "../../middleware/validateMiddleware.js";
import {
  subscribedStore,
  subscriptionStatus,
} from "./subscriptions.controller.js";

const subscriptionRoutes = express.Router();

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
