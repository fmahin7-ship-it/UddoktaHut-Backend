import { Role, Store, User, UserRole } from "../models/RootModel.js";
import { promisify } from "util";
import { generateTokens } from "./commonService.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const verifyJwt = promisify(jwt.verify);

const emailPasswordMissMatch = () => {
  const error = new Error("Invalid email or password");
  error.statusCode = 401;
  throw error;
};

const getUserToken = async (userData) => {
  const { email, phoneNumber, password } = userData;

  if (!email && !phoneNumber)
    throw new Error("Please sign in using your email or phone");

  const user = await User.findOne({
    where: email ? { email } : { phone_number: phoneNumber },
    include: [
      {
        model: Role,
        through: { model: UserRole, attributes: ["onboarded"] },
        attributes: ["id", "role_name"],
      },
      {
        model: Store,
      },
    ],
  });
  if (!user) emailPasswordMissMatch();

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
  const tokens = generateTokens(payload, onboarded);
  return { tokens, onboarded };
};

const getRefreshToken = async (data) => {
  const { refreshToken } = data;

  const decode = await verifyJwt(refreshToken, env.JWT_REFRESH_TOKEN);
  return generateTokens(decode, decode.onboarded);
};

export { getUserToken, getRefreshToken };
