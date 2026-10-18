import z from "zod";

const emailproviderSchema = z.object({
  email: z
    .string({ message: "Email is required" })
    .email({ message: "Email is not corect" }),
  name: z.string({ message: "Name is required" }),
  password: z.string({ message: "Password is required" }),
});

const emailVerifySchema = z.object({
  identifier: z
    .string({ message: "Email is required" })
    .email({ message: "Email is not corect" }),
  otp: z.number({ message: "Otp is required" }).min(0),
});

export { emailproviderSchema, emailVerifySchema };
