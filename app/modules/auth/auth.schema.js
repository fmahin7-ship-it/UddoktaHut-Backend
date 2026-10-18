import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Please provide correct email address").optional(),
  phoneNumber: z
    .string()
    .regex(/^\+8801[3-9][0-9]{8}$/, "Invalid Bangladeshi phone number")
    .length(14, "Phone number must be exactly 13 characters")
    .optional(),
  password: z.string({ message: "Please provide password" }),
});

export { loginSchema };
