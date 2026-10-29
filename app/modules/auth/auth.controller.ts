import type { AsyncRoute } from "../../types/http.ts";
import { getRefreshToken, getUserToken } from "./auth.service.ts";
import {
  clearCookie,
  setCookieAccessRefreshToken,
} from "../../services/commonService.ts";

const loginUser: AsyncRoute = async (req, res, next) => {
  try {
    const verifiedTokens = await getUserToken(req.body);
    if (!verifiedTokens) {
      res.status(401).json({
        message: "Invalid user",
      });
      return;
    }

    setCookieAccessRefreshToken(res, verifiedTokens.tokens);

    res.status(200).json({
      tokens: verifiedTokens.tokens,
      onboarded: verifiedTokens.onboarded,
    });
  } catch (err) {
    next(err);
  }
};

const logout: AsyncRoute = (_req, res, next) => {
  try {
    clearCookie(res);
    res.status(200).json({ isLoggedOut: true });
  } catch (err) {
    next(err);
  }
};

const refreshToken: AsyncRoute = (req, res, next) => {
  try {
    const accessToken = getRefreshToken(req.body);
    res.status(200).json({ accessToken });
  } catch (err) {
    next(err);
  }
};

export { loginUser, logout, refreshToken };
