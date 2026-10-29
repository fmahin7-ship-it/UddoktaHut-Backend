import { generateTokens } from "../../services/commonService.ts";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.ts";
import { findUserForLogin } from "../../db/userQueries.ts";
import { assertFound } from "../../lib/throwError.ts";

const emailPasswordMissMatch = (): never => {
  const error = new Error("Invalid email or password") as Error & {
    statusCode: number;
  };
  error.statusCode = 401;
  throw error;
};

const getUserToken = async (userData: {
  email?: string;
  phoneNumber?: string;
  password: string;
}) => {
  const { email, phoneNumber, password } = userData;

  if (!email && !phoneNumber)
    throw new Error("Please sign in using your email or phone");

  const user = await findUserForLogin(
    email ? { email } : { phone_number: phoneNumber }
  );
  assertFound(user, "Invalid email or password", 401);

  const comparedPassword = await bcrypt.compare(password, user.password);

  if (!comparedPassword) emailPasswordMissMatch();

  const payload = {
    id: user.id,
    email: user.email,
    roles: user.Roles.map((role) => role.id),
    storeName: user.Store?.store_name,
    storeAddress: user.Store?.store_address,
    storeType: user.Store?.store_type,
    storeUrl: user.Store?.store_url,
    country: user.Store?.country,
  };
  const onboarded = user.Roles[0]?.user_roles?.onboarded;
  const tokens = generateTokens(payload, onboarded ?? false);
  return { tokens, onboarded };
};

const getRefreshToken = (data: { refreshToken: string }) => {
  const { refreshToken } = data;

  const decode = jwt.verify(
    refreshToken,
    env.JWT_REFRESH_TOKEN
  ) as jwt.JwtPayload & {
    onboarded?: boolean;
    id?: number;
    email?: string;
    phoneNumber?: string;
    roles?: unknown;
    storeUrl?: string;
    country?: string;
  };

  return generateTokens(decode, decode.onboarded ?? false).accessToken;
};

export { getUserToken, getRefreshToken };
