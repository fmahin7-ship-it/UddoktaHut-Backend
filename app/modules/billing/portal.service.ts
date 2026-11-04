import { env } from "../../config/env.ts";
import { createAppError } from "../../lib/appError.ts";
import type { AuthUser } from "../../types/express.d.ts";
import { loadOwnerStoreContext } from "../subscriptions/ownerContext.ts";
import {
  rethrowAsBillingError,
  stripeNotConfiguredError,
} from "./billing.errors.ts";
import { getStripe } from "./providers/stripe.ts";

/** Stripe-hosted portal for cancel, card update, and invoices. */
const createBillingPortalSession = async (user: AuthUser) => {
  if (!env.STRIPE_SECRET_KEY) throw stripeNotConfiguredError();

  const { subscription } = await loadOwnerStoreContext(user.id);
  if (!subscription?.stripe_customer_id) {
    throw createAppError(
      "No Stripe billing account for this store yet.",
      400,
      "PORTAL_UNAVAILABLE"
    );
  }

  const base = env.APP_PUBLIC_URL.replace(/\/$/, "");
  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${base}/dashboard/billing`,
    });
    if (!portal.url) {
      throw createAppError(
        "Stripe did not return a billing portal link.",
        502,
        "PORTAL_FAILED"
      );
    }
    return { url: portal.url };
  } catch (err) {
    return rethrowAsBillingError(
      err,
      "Stripe portal failed",
      "Could not open billing portal. Please try again.",
      "PORTAL_FAILED"
    );
  }
};

export { createBillingPortalSession };
