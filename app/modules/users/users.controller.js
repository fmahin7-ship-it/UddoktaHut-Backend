import { setCookieAccessRefreshToken } from "../../services/commonService.js";
import {
  sendEmailVarification,
  verifyEmailToProceed,
  sendSmsProvider,
  verifySmsProvider,
  onboardedAccess,
  assignRoleToUserAndCreateStore,
} from "./users.service.js";
import { resolveSignupCountry } from "../../utils/requestCountry.js";

const sendEmail = async (req, res, next) => {
  try {
    await sendEmailVarification(req.body);
    res.status(200).json({
      success: true,
      message: "Otp sended successfully please check you email",
    });
  } catch (err) {
    next(err);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const verifiedTokens = await verifyEmailToProceed(req.body);
    if (!verifiedTokens)
      return res.status(400).json({
        verified: false,
        error: "Invalid or expired otp",
        status: 400,
      });

    setCookieAccessRefreshToken(res, verifiedTokens);

    return res.status(200).json({
      verified: true,
      message: "Email verified successfully",
      status: 200,
    });
  } catch (err) {
    next(err);
  }
};

const sendSms = async (req, res, next) => {
  try {
    const result = await sendSmsProvider(req.body);
    if (result.response_code === 202)
      return res.status(result.response_code).json({
        success: true,
        message: result.success_message,
      });
    return res
      .status(result.response_code)
      .json({ error: result.error_message });
  } catch (err) {
    next(err);
  }
};

const smsVerify = async (req, res, next) => {
  try {
    const verifiedTokens = await verifySmsProvider(req.body);
    if (!verifiedTokens)
      return res.status(400).json({
        verified: false,
        error: "Invalid or expired otp",
      });
    setCookieAccessRefreshToken(res, verifiedTokens);

    return res.status(200).json({
      verified: true,
      message: "Otp verified ✅",
      status: 200,
    });
  } catch (err) {
    next(err);
  }
};

const userOnboardedAccess = async (req, res, next) => {
  try {
    const { id } = req.body;
    const result = await onboardedAccess(id);
    if (!result)
      return res.status(401).json({
        isAuth: false,
        error: "Not authorized",
      });
    return res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
};

const addRolesToUserAndStore = async (req, res, next) => {
  try {
    const verifiedTokens = await assignRoleToUserAndCreateStore({
      ...req.body,
      country: resolveSignupCountry(req, req.body.country),
    });
    if (!verifiedTokens)
      return res.status(400).json({
        onboarded: false,
        message: "Invalid or expired otp",
      });

    setCookieAccessRefreshToken(res, verifiedTokens.tokens);
    return res.status(201).json({
      tokens: verifiedTokens.tokens,
      onboarded: verifiedTokens.onboarded,
    });
  } catch (err) {
    next(err);
  }
};

export {
  sendEmail,
  verifyEmail,
  sendSms,
  smsVerify,
  addRolesToUserAndStore,
  userOnboardedAccess,
};
