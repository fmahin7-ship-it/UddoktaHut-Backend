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
import { slugifyStoreName, buildStoreUrl } from "../../utils/storeUrl.ts";
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
  if (userExist) throw new Error("User already exist");

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

  const tokenData = (await tokenResp.json()) as { access_token?: string };
  const accessToken = tokenData.access_token;

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

  return await sendResp.json();
};

const verifyEmailToProceed = async (data: { identifier: string; otp: number }) => {
  const { identifier, otp } = data;
  const record = verifyOtp(identifier, Number(otp));
  if (record) {
    const { name, password } = record;
    if (!name || !password) throw new Error("No name or password found!");
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
  if (existUser) throw new Error("User already exist");

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
  return await response.json();
};

const verifySmsProvider = async (data: { identifier: string; otp: number }) => {
  const { identifier, otp } = data;
  const record = verifyOtp(identifier, Number(otp));
  if (record) {
    const { name, password } = record;
    if (!name || !password) throw new Error("No name or password found!");
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

  if (!user) throw new Error("User not found");

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

  if (!validUser) throw new Error("User is invalid");

  if (validRoles.length !== roleIds.length)
    throw new Error("Some roles are invalid");

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
  if (!storeSlug) throw new Error("Invalid business name");

  const resolvedStoreUrl = buildStoreUrl(storeSlug);

  try {
    return await db.transaction(async (tx) => {
      const existStore = await tx.query.stores.findFirst({
        where: eq(stores.store_name, storeSlug),
      });
      if (existStore)
        throw new Error("This (business/store) name already exist");

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
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(message);
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
