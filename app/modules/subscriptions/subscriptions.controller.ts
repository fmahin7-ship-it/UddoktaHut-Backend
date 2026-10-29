import type { AsyncRoute } from "../../types/http.ts";
import {
  getSubscribedStore,
  getSubscriptionStatus,
} from "./subscriptions.service.ts";

const subscriptionStatus: AsyncRoute = async (req, res, next) => {
  try {
    const body = req.body as { userId: number };
    const { user } = await getSubscriptionStatus(body);
    res.status(200).json({ user });
  } catch (err: unknown) {
    next(err);
  }
};

const subscribedStore: AsyncRoute = async (req, res, next) => {
  try {
    const { storeData } = await getSubscribedStore({
      storeName: String(req.params.storeName),
    });
    res.set("Cache-Control", "public, max-age=60");
    res.status(200).json({ storeData });
  } catch (err: unknown) {
    next(err);
  }
};

export { subscriptionStatus, subscribedStore };
