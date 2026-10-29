import express from "express";
import {
  subscribedStoreSchema,
  subscriptionSchema,
} from "./subscriptions.schema.ts";
import { validate } from "../../middleware/validateMiddleware.ts";
import {
  subscribedStore,
  subscriptionStatus,
} from "./subscriptions.controller.ts";

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
