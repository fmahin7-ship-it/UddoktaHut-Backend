import {
  getSubscribedStore,
  getSubscriptionStatus,
} from "../services/subscriptionService.js";
import { createCheckoutSession } from "../services/billing/createCheckoutSession.js";

const subscriptionStatus = async (req, res, next) => {
  try {
    const { user } = await getSubscriptionStatus(req.body);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
};

const subscribedStore = async (req, res, next) => {
  try {
    const { storeData } = await getSubscribedStore(req.params);
    res.set("Cache-Control", "public, max-age=60");
    res.status(200).json({ storeData });
  } catch (err) {
    next(err);
  }
};

const createCheckout = async (req, res, next) => {
  try {
    const { url } = await createCheckoutSession({
      user: req.user,
      planSlug: req.body.plan,
    });
    res.status(200).json({ url });
  } catch (err) {
    next(err);
  }
};

export { subscriptionStatus, subscribedStore, createCheckout };
