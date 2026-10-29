import Stripe from "stripe";
import { env } from "../../../config/env.ts";

let client: Stripe | undefined;

/** Created on first use, so the API still boots when Stripe is not configured. */
const getStripe = (): Stripe => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!client) {
    client = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return client;
};

export { getStripe };
