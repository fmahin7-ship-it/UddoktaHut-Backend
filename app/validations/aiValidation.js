import z from "zod";

const aiQuerySchema = z.object({
  question: z
    .string({ message: "Question is required" })
    .min(3, "Question must be at least 3 characters long")
    .max(500, "Question must not exceed 500 characters")
    .refine(
      (val) => val.trim().length > 0,
      "Question cannot be empty or only spaces"
    ),
});

export { aiQuerySchema };
