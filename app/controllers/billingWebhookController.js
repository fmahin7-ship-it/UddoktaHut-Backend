import { env } from "../config/env.js";
import { applyStripeEvent } from "../services/billing/applyStripeEvent.js";
import { getStripe } from "../services/billing/stripeClient.js";

const stripeWebhook = async (req, res) => {
  if (!env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: "Webhook is not configured." });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Stripe webhook signature rejected", err.message);
    return res.status(400).json({ error: "Invalid signature." });
  }

  try {
    await applyStripeEvent(event);
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Stripe webhook failed", event.id, event.type, err.message);
    return res.status(500).json({ error: "Webhook processing failed." });
  }
};

export { stripeWebhook };
