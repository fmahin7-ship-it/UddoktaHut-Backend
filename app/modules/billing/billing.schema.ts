import { z } from "zod";

const checkoutSchema = z.object({
  plan: z.enum(["pro", "business"], {
    errorMap: () => ({
      message: "Only Pro or Business can be checked out right now.",
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

const changePlanSchema = z.object({
  plan: z.enum(["pro", "business"], {
    errorMap: () => ({
      message: "Only Pro or Business can be selected.",
    }),
  }),
});

export { changePlanSchema, checkoutSchema, confirmCheckoutSchema };
