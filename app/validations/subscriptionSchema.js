import { z } from "zod";

const subscriptionSchema = z.object({
  userId: z
    .number({ message: "user ID is required" })
    .min(1, { message: "User ID must be a positive integer." }),
});

const subscribedStoreSchema = z.object({
  storeName: z.string({ message: "Store name is required" }),
});

const checkoutSchema = z.object({
  plan: z.literal("pro", {
    errorMap: () => ({
      message: "Only the Pro plan can be checked out right now.",
    }),
  }),
});

export { subscriptionSchema, subscribedStoreSchema, checkoutSchema };
