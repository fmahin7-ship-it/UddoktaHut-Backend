import { z } from "zod";

const checkoutSchema = z.object({
  plan: z.literal("pro", {
    errorMap: () => ({
      message: "Only the Pro plan can be checked out right now.",
    }),
  }),
});

const confirmCheckoutSchema = z.object({
  sessionId: z
    .string()
    .trim()
    .min(1, "sessionId is required")
    .regex(/^cs_/, "sessionId must be a Stripe Checkout session id"),
});

export { checkoutSchema, confirmCheckoutSchema };
