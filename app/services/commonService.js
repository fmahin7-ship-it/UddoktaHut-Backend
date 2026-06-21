import { env } from "../config/env.js";

import jwt from "jsonwebtoken";

const generateTokens = (user, onboarded) => {
  const data = {
    id: user.id,
    onboarded: onboarded,
    roles: user.roles || null,
    storeUrl: user.storeUrl,
  };
  user.email
    ? (data.email = user.email)
    : (data.phoneNumber = user.phoneNumber);

  const accessToken = jwt.sign(data, env.JWT_SECRET, { expiresIn: "1h" });

  const refreshToken = jwt.sign(data, env.JWT_REFRESH_TOKEN, {
    expiresIn: "7d",
  });

  return { accessToken, refreshToken };
};

const setCookieAccessRefreshToken = (res, verifiedTokens) => {
  const { accessToken, refreshToken } = verifiedTokens;
  const cookieOption = {
    httpOnly: true,
    secure: env.isProd ? true : false,
    sameSite: env.isProd ? "None" : "Lax",
    path: "/",
    maxAge: 60 * 60 * 1000,
  };

  if (env.isProd) {
    cookieOption.domain = ".uddoktahut.com";
  } else if (env.isDev) {
    cookieOption.domain = ".uddoktahut.local";
  }

  res.cookie("accessToken", accessToken, cookieOption);

  res.cookie("refreshToken", refreshToken, cookieOption);
};

const clearCookie = (res) => {
  const cookieOption = {
    httpOnly: true,
    secure: env.isProd ? true : false,
    sameSite: env.isProd ? "None" : "Lax",
    path: "/",
  };
  if (env.isProd) {
    cookieOption.domain = ".uddoktahut.com";
  } else if (env.isDev) {
    cookieOption.domain = ".uddoktahut.local";
  }
  res.clearCookie("accessToken", cookieOption);
  res.clearCookie("refreshToken", cookieOption);
};

export { generateTokens, setCookieAccessRefreshToken, clearCookie };
