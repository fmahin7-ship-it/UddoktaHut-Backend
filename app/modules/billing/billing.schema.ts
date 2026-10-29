import { z } from "zod";

const checkoutSchema = z.object({
  plan: z.literal("pro", {
    errorMap: () => ({
      message: "Only the Pro plan can be checked out right now.",
    }),
  }),
});

export { checkoutSchema };
