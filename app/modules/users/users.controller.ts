import { setCookieAccessRefreshToken } from "../../services/commonService.ts";
import type { AsyncRoute } from "../../types/http.ts";
import { resolveSignupCountry } from "../../utils/requestCountry.ts";
import {
  sendEmailVarification,
  verifyEmailToProceed,
  sendSmsProvider,
  verifySmsProvider,
  onboardedAccess,
  assignRoleToUserAndCreateStore,
} from "./users.service.ts";

const sendEmail: AsyncRoute = async (req, res, next) => {
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

const verifyEmail: AsyncRoute = async (req, res, next) => {
  try {
    const verifiedTokens = await verifyEmailToProceed(req.body);
    if (!verifiedTokens) {
      res.status(400).json({
        verified: false,
        error: "Invalid or expired otp",
        status: 400,
      });
      return;
    }

    setCookieAccessRefreshToken(res, verifiedTokens);

    res.status(200).json({
      verified: true,
      message: "Email verified successfully",
      status: 200,
    });
  } catch (err) {
    next(err);
  }
};

const sendSms: AsyncRoute = async (req, res, next) => {
  try {
    const result = (await sendSmsProvider(req.body)) as {
      response_code?: number;
      success_message?: string;
      error_message?: string;
    };
    if (result.response_code === 202) {
      res.status(result.response_code).json({
        success: true,
        message: result.success_message,
      });
      return;
    }
    res
      .status(result.response_code ?? 500)
      .json({ error: result.error_message });
  } catch (err) {
    next(err);
  }
};

const smsVerify: AsyncRoute = async (req, res, next) => {
  try {
    const verifiedTokens = await verifySmsProvider(req.body);
    if (!verifiedTokens) {
      res.status(400).json({
        verified: false,
        error: "Invalid or expired otp",
      });
      return;
    }
    setCookieAccessRefreshToken(res, verifiedTokens);

    res.status(200).json({
      verified: true,
      message: "Otp verified ✅",
      status: 200,
    });
  } catch (err) {
    next(err);
  }
};

const userOnboardedAccess: AsyncRoute = async (req, res, next) => {
  try {
    const { id } = req.body as { id: number };
    const result = await onboardedAccess(id);
    if (!result) {
      res.status(401).json({
        isAuth: false,
        error: "Not authorized",
      });
      return;
    }
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
};

const addRolesToUserAndStore: AsyncRoute = async (req, res, next) => {
  try {
    const body = req.body as {
      userId: number;
      roles: number[];
      storeName: string;
      storeAddress: string;
      storeType: string;
      country?: unknown;
    };
    const verifiedTokens = await assignRoleToUserAndCreateStore({
      userId: body.userId,
      roles: body.roles,
      storeName: body.storeName,
      storeAddress: body.storeAddress,
      storeType: body.storeType,
      country: resolveSignupCountry(req, body.country),
    });
    if (!verifiedTokens) {
      res.status(400).json({
        onboarded: false,
        message: "Invalid or expired otp",
      });
      return;
    }

    setCookieAccessRefreshToken(res, verifiedTokens.tokens);
    res.status(201).json({
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
