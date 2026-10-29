import { env } from "../config/env.ts";
import type { CookieOptions, Response } from "express";
import jwt from "jsonwebtoken";

const generateTokens = (
  user: Record<string, unknown>,
  onboarded: boolean
) => {
  const data: Record<string, unknown> = {
    id: user.id,
    onboarded,
    roles: user.roles ?? null,
    storeUrl: user.storeUrl,
    country: user.country,
  };
  if (user.email) {
    data.email = user.email;
  } else {
    data.phoneNumber = user.phoneNumber;
  }

  const accessToken = jwt.sign(data, env.JWT_SECRET, { expiresIn: "1h" });

  const refreshToken = jwt.sign(data, env.JWT_REFRESH_TOKEN, {
    expiresIn: "7d",
  });

  return { accessToken, refreshToken };
};

const setCookieAccessRefreshToken = (
  res: Response,
  verifiedTokens: { accessToken: string; refreshToken: string }
) => {
  const { accessToken, refreshToken } = verifiedTokens;
  const cookieOption: CookieOptions = {
    httpOnly: true,
    secure: env.isProd ? true : false,
    sameSite: (env.isProd ? "none" : "lax") as CookieOptions["sameSite"],
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

const clearCookie = (res: Response) => {
  const cookieOption: CookieOptions = {
    httpOnly: true,
    secure: env.isProd ? true : false,
    sameSite: (env.isProd ? "none" : "lax") as CookieOptions["sameSite"],
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
