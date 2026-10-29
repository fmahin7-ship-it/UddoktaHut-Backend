import type { Request, Response } from "express";
import type Stripe from "stripe";
import { env } from "../../config/env.ts";
import { requireUser } from "../../lib/requireUser.ts";
import type { AsyncRoute } from "../../types/http.ts";
import { applyStripeEvent, createCheckoutSession } from "./billing.service.ts";
import { getStripe } from "./providers/stripe.ts";

const createCheckout: AsyncRoute = async (req, res, next) => {
  try {
    const user = requireUser(req);
    const body = req.body as { plan: string };
    const { url } = await createCheckoutSession({
      user,
      planSlug: body.plan,
    });
    res.status(200).json({ url });
  } catch (err: unknown) {
    next(err);
  }
};

type StripeWebhookRequest = Request & { body: Buffer };

const stripeWebhook = async (
  req: StripeWebhookRequest,
  res: Response
): Promise<void> => {
  if (!env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_SECRET_KEY) {
    res.status(500).json({ error: "Webhook is not configured." });
    return;
  }

  let event: Stripe.Event;
  try {
    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") {
      res.status(400).json({ error: "Invalid signature." });
      return;
    }
    event = getStripe().webhooks.constructEvent(
      req.body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: unknown) {
    console.error(
      "Stripe webhook signature rejected",
      err instanceof Error ? err.message : err
    );
    res.status(400).json({ error: "Invalid signature." });
    return;
  }

  try {
    await applyStripeEvent({
      id: event.id,
      type: event.type,
      data: event.data as {
        object?: {
          id?: string | null;
          mode?: string | null;
          status?: string | null;
          payment_status?: string | null;
          subscription?: unknown;
          customer?: unknown;
          client_reference_id?: string | null;
          metadata?: Record<string, string> | null;
        };
      },
    });
    res.status(200).json({ received: true });
  } catch (err: unknown) {
    console.error(
      "Stripe webhook failed",
      event.id,
      event.type,
      err instanceof Error ? err.message : err
    );
    res.status(500).json({ error: "Webhook processing failed." });
  }
};

export { createCheckout, stripeWebhook };
