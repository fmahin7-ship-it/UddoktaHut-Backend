import express from "express";
import { validate } from "../../middleware/validateMiddleware.js";
import { userRolesAndStoreSchema } from "./users.schema.js";
import {
  addRolesToUserAndStore,
  sendEmail,
  sendSms,
  smsVerify,
  userOnboardedAccess,
  verifyEmail,
} from "./users.controller.js";
import {
  emailproviderSchema,
  emailVerifySchema,
} from "./emailProvider.js";
import {
  smsProviderSchema,
  smsProviderVerifySchema,
} from "./smsProvider.js";

const userRoutes = express.Router();

userRoutes.post("/mail/send", validate(emailproviderSchema), sendEmail);
userRoutes.post("/mail/verify", validate(emailVerifySchema), verifyEmail);

userRoutes.post("/sms/send", validate(smsProviderSchema), sendSms);
userRoutes.post("/sms/verify", validate(smsProviderVerifySchema), smsVerify);

userRoutes.post("/authenticate", userOnboardedAccess);

userRoutes.post(
  "/assign-role",
  validate(userRolesAndStoreSchema),
  addRolesToUserAndStore
);

export { userRoutes };
