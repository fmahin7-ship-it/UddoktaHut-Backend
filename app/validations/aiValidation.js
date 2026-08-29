import z from "zod";

const historyMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z
    .string()
    .max(2000, "History message must not exceed 2000 characters")
    .refine(
      (val) => val.trim().length > 0,
      "History message cannot be empty or only spaces"
    ),
});

const aiQuerySchema = z.object({
  question: z
    .string({ message: "Question is required" })
    .max(500, "Question must not exceed 500 characters")
    .refine(
      (val) => val.trim().length > 0,
      "Question cannot be empty or only spaces"
    ),
  history: z.array(historyMessageSchema).max(8).optional(),
});

export { aiQuerySchema };
