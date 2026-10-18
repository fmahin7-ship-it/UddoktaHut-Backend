import Stripe from "stripe";
import { env } from "../../../config/env.js";

let client;

/** Created on first use, so the API still boots when Stripe is not configured. */
const getStripe = () => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!client) {
    client = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return client;
};

export { getStripe };
