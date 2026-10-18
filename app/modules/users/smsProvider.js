import z from "zod";

const smsProviderSchema = z.object({
  phoneNumber: z.string({ message: "Phone Number is required" }),
  name: z.string({ message: "Name is required" }),
  password: z.string({ message: "Password is required" }),
});

const smsProviderVerifySchema = z.object({
  identifier: z
    .string({ message: "Phone number is required" })
    .regex(/^\+8801[3-9][0-9]{8}$/, "Invalid Bangladeshi phone number")
    .length(14, "Phone number must be exactly 13 characters"),
  otp: z.number({ message: "Otp is required" }).min(0),
});

export { smsProviderSchema, smsProviderVerifySchema };
