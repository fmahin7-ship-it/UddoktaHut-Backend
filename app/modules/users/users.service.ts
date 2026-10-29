import {
  generateOtp,
  passwordHashing,
  saveOtp,
  verifyOtp,
} from "../../lib/utils.ts";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client.ts";
import {
  roles,
  stores,
  subscriptions,
  userRoles,
  users,
} from "../../db/schema/index.ts";
import { env } from "../../config/env.ts";
import { getTrialPlanId } from "../subscriptions/planCatalog.ts";
import nodemailer from "nodemailer";
import { generateTokens } from "../../services/commonService.ts";
import {
  slugifyStoreName,
  buildStoreUrl,
  isReservedStoreSlug,
  MAX_STORE_SLUG_LENGTH,
} from "../../utils/storeUrl.ts";
import { assertFound, throwError } from "../../lib/throwError.ts";
import type { Database } from "../../db/client.ts";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: Number(env.SMTP_PORT),
  secure: true,
  auth: {
    user: env.UDDOKTAHUT_EMAIL,
    pass: env.ZOHO_APP_PASSWORD,
  },
  logger: true,
  debug: true,
});

void transporter;

const sendEmailVarification = async (data: {
  email: string;
  name: string;
  password: string;
}) => {
  const { email, name, password } = data;
  const userExist = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (userExist)
    throwError("An account with this email already exists. Please log in.", 409);

  const { hashedPassword } = await passwordHashing(password);
  const otp = generateOtp();
  saveOtp({ identifier: email, name, password: hashedPassword }, Number(otp));

  const tokenParams = new URLSearchParams({
    refresh_token: env.ZOHO_REFRESH_TOKEN ?? "",
    client_id: env.ZOHO_CLIENT_ID ?? "",
    client_secret: env.ZOHO_CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
  });

  const tokenResp = await fetch("https://accounts.zoho.com/oauth/v2/token", {
    method: "POST",
    body: tokenParams,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const tokenData = (await tokenResp.json().catch(() => ({}))) as { access_token?: string };
  const accessToken = tokenData.access_token;
  if (!tokenResp.ok || !accessToken) {
    console.error("Zoho token refresh failed", tokenResp.status, tokenData);
    throwError("Could not send the verification email. Please try again shortly.", 502);
  }

  const accountId = env.ZOHO_ACCOUNT_ID;

  const subject = "Please verify your email";
  const content = `
      <main style="display: flex; flex-direction: column; margin: 0 auto">
        <p style="font-weight: 700; font-size: 20px">Welcome to UddoktaHut, ${name}</p>
        <p style="font-weight: 500; font-size: 16px">Your OTP is: <b>${otp}</b></p>
      </main>
    `;

  const sendResp = await fetch(
    `https://mail.zoho.com/api/accounts/${accountId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fromAddress: process.env.UDDOKTAHUT_EMAIL,
        toAddress: email,
        subject,
        content,
      }),
    }
  );

  const sendData: unknown = await sendResp.json().catch(() => null);
  if (!sendResp.ok) {
    console.error("Zoho send failed", sendResp.status, sendData);
    throwError("Could not send the verification email. Please try again shortly.", 502);
  }
  return sendData;
};

const verifyEmailToProceed = async (data: { identifier: string; otp: number }) => {
  const { identifier, otp } = data;
  const record = verifyOtp(identifier, Number(otp));
  if (record) {
    const { name, password } = record;
    if (!name || !password)
      throwError("Your sign-up session expired. Please sign up again.", 400);
    const [user] = await db
      .insert(users)
      .values({ email: identifier, name, password })
      .returning();
    const userPayload = {
      id: user!.id,
      email: user!.email,
    };
    return generateTokens(userPayload, false);
  }
  return null;
};

const sendSmsProvider = async (data: {
  phoneNumber: string;
  name: string;
  password: string;
}) => {
  const { phoneNumber, name, password } = data;

  const existUser = await db.query.users.findFirst({
    where: eq(users.phone_number, phoneNumber),
  });
  if (existUser)
    throwError("An account with this phone number already exists. Please log in.", 409);

  const { hashedPassword } = await passwordHashing(password);
  const otp = generateOtp();
  saveOtp(
    { identifier: phoneNumber, name, password: hashedPassword },
    Number(otp)
  );
  const response = await fetch(env.SMS_URL ?? "", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: env.SMS_API_KEY,
      type: env.SMS_TYPE,
      number: phoneNumber,
      senderid: env.SMS_SENDER_ID,
      message: `Your otp for uddoktahut is: ${otp}`,
    }),
  });
  const smsData: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("SMS send failed", response.status, smsData);
    throwError("Could not send the verification SMS. Please try again shortly.", 502);
  }
  return smsData;
};

const verifySmsProvider = async (data: { identifier: string; otp: number }) => {
  const { identifier, otp } = data;
  const record = verifyOtp(identifier, Number(otp));
  if (record) {
    const { name, password } = record;
    if (!name || !password)
      throwError("Your sign-up session expired. Please sign up again.", 400);
    const [user] = await db
      .insert(users)
      .values({
        name,
        password,
        phone_number: identifier,
      })
      .returning();
    const userPayload = {
      id: user!.id,
      phoneNumber: user!.phone_number,
    };
    return generateTokens(userPayload, false);
  }
  return null;
};

const onboardedAccess = async (id: number) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
    with: {
      roleAssignments: { with: { role: true } },
      store: true,
    },
  });

  assertFound(user, "User not found", 404);

  return {
    name: user.name,
    email: user.email,
    phoneNumber: user.phone_number,
    onboarded: user.roleAssignments[0]?.onboarded,
    role: user.roleAssignments[0]?.role_id,
  };
};

async function validateUserAndRoles(
  userId: number,
  roleIds: number[],
  tx: Tx
) {
  const [validUser, validRoles] = await Promise.all([
    tx.query.users.findFirst({ where: eq(users.id, userId) }),
    tx.select().from(roles).where(inArray(roles.id, roleIds)),
  ]);

  assertFound(validUser, "User is invalid", 400);

  if (validRoles.length !== roleIds.length)
    throwError("Some roles are invalid", 400);

  return { validUser, validRoles };
}

async function clearPreviousUserData(userId: number, tx: Tx) {
  await tx.delete(userRoles).where(eq(userRoles.user_id, userId));
  await tx.delete(stores).where(eq(stores.user_id, userId));
}

async function createUserRoles(
  userId: number,
  roleIds: number[],
  onboarded: boolean,
  tx: Tx
) {
  return tx
    .insert(userRoles)
    .values(
      roleIds.map((roleId) => ({
        user_id: userId,
        role_id: roleId,
        onboarded,
      }))
    )
    .returning();
}

async function createStoreAndSubscription(
  userId: number,
  storeData: {
    store_name: string;
    store_address: string;
    store_type: string;
    store_url: string;
    country: string;
  },
  tx: Tx
) {
  const [store] = await tx
    .insert(stores)
    .values({ user_id: userId, ...storeData })
    .returning();

  const now = new Date();
  const trialEnds = new Date(now);
  trialEnds.setDate(now.getDate() + 7);

  const trialPlanId = await getTrialPlanId();

  await tx.insert(subscriptions).values({
    store_id: store!.id,
    status: "trialing",
    start_date: now,
    trial_ends_at: trialEnds,
    end_date: trialEnds,
    is_auto_renew: false,
    plan_id: trialPlanId,
  });

  return store!;
}

function generateFinalTokenAfterOnboarded(
  validUser: { id: number; email: string | null; phone_number?: string | null },
  roleIds: number[],
  store: {
    store_name: string;
    store_address: string;
    store_type: string;
    store_url: string;
    country: string;
  },
  onboarded: boolean
) {
  const payload = validUser.email
    ? {
        id: validUser.id,
        email: validUser.email,
        roles: roleIds,
        storeName: store.store_name,
        storeAddress: store.store_address,
        storeType: store.store_type,
        storeUrl: store.store_url,
        country: store.country,
      }
    : {
        id: validUser.id,
        phoneNumber: validUser.phone_number,
        roles: roleIds,
        storeName: store.store_name,
        storeAddress: store.store_address,
        storeType: store.store_type,
        storeUrl: store.store_url,
        country: store.country,
      };

  const tokens = generateTokens(payload, onboarded);
  return { tokens, onboarded };
}

const assignRoleToUserAndCreateStore = async (data: {
  userId: number;
  roles: number[];
  storeName: string;
  storeAddress: string;
  storeType: string;
  country: string;
}) => {
  const { userId, roles: roleIds, storeName, storeAddress, storeType, country } =
    data;
  const storeSlug = slugifyStoreName(storeName);
  if (!storeSlug) throwError("Invalid business name", 400);
  if (storeSlug.length > MAX_STORE_SLUG_LENGTH)
    throwError(
      `Store name is too long (max ${MAX_STORE_SLUG_LENGTH} characters)`,
      400
    );
  if (isReservedStoreSlug(storeSlug))
    throwError(
      "This store name isn't available. Please choose another name.",
      409
    );

  const resolvedStoreUrl = buildStoreUrl(storeSlug);

  try {
    return await db.transaction(async (tx) => {
      const existStore = await tx.query.stores.findFirst({
        where: eq(stores.store_name, storeSlug),
      });
      if (existStore)
        throwError("This (business/store) name already exist", 409);

      const isAdmin = roleIds.includes(1);
      const onboarded = isAdmin;

      const { validUser } = await validateUserAndRoles(
        userId,
        roleIds,
        tx
      );
      await clearPreviousUserData(validUser.id, tx);

      const createdRoles = await createUserRoles(
        validUser.id,
        roleIds,
        onboarded,
        tx
      );
      const store = await createStoreAndSubscription(
        validUser.id,
        {
          store_name: storeSlug,
          store_address: storeAddress,
          store_type: storeType,
          store_url: resolvedStoreUrl,
          country,
        },
        tx
      );

      const storePayload = {
        store_name: storeSlug,
        store_address: storeAddress,
        store_type: storeType,
        store_url: resolvedStoreUrl,
        country: store.country,
      };

      if (createdRoles?.length && store)
        return generateFinalTokenAfterOnboarded(
          validUser,
          roleIds,
          storePayload,
          onboarded
        );
      return null;
    });
  } catch (err) {
    // Rethrow as-is so a statusCode set by throwError survives (a 4xx message
    // reaches the seller instead of being masked as a 500 in production).
    throw err;
  }
};

export {
  sendEmailVarification,
  verifyEmailToProceed,
  sendSmsProvider,
  verifySmsProvider,
  assignRoleToUserAndCreateStore,
  onboardedAccess,
};
