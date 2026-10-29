import express from "express";
import {
  otpSendRateLimit,
  otpVerifyRateLimit,
} from "../../middleware/rateLimitMiddleware.ts";
import { validate } from "../../middleware/validateMiddleware.ts";
import {
  emailproviderSchema,
  emailVerifySchema,
} from "./emailProvider.ts";
import {
  smsProviderSchema,
  smsProviderVerifySchema,
} from "./smsProvider.ts";
import { userRolesAndStoreSchema } from "./users.schema.ts";
import {
  addRolesToUserAndStore,
  sendEmail,
  sendSms,
  smsVerify,
  userOnboardedAccess,
  verifyEmail,
} from "./users.controller.ts";

const userRoutes = express.Router();

userRoutes.post(
  "/mail/send",
  otpSendRateLimit,
  validate(emailproviderSchema),
  sendEmail
);
userRoutes.post(
  "/mail/verify",
  otpVerifyRateLimit,
  validate(emailVerifySchema),
  verifyEmail
);

userRoutes.post(
  "/sms/send",
  otpSendRateLimit,
  validate(smsProviderSchema),
  sendSms
);
userRoutes.post(
  "/sms/verify",
  otpVerifyRateLimit,
  validate(smsProviderVerifySchema),
  smsVerify
);

userRoutes.post("/authenticate", userOnboardedAccess);

userRoutes.post(
  "/assign-role",
  validate(userRolesAndStoreSchema),
  addRolesToUserAndStore
);

export { userRoutes };
