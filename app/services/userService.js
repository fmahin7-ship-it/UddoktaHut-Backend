import {
  generateOtp,
  passwordHashing,
  saveOtp,
  verifyOtp,
} from "../lib/utils.js";
import {
  Role,
  sequelize,
  UserRole,
  Subscription,
} from "../models/RootModel.js";
import { env } from "../config/env.js";
import { User, Store } from "../models/RootModel.js";
import nodemailer from "nodemailer";
import { generateTokens } from "./commonService.js";
import { slugifyStoreName, buildStoreUrl } from "../utils/storeUrl.js";

//https://accounts.zoho.com/oauth/v2/auth?scope=ZohoMail.accounts.READ,ZohoMail.messages.CREATE&client_id=1000.I6ZNQQJB3BARTHKXYP5O8M5ZSAFFSC&response_type=code&access_type=offline&redirect_uri=https://uddoktahut.com
// https://accounts.zoho.com/oauth/v2/auth?scope=ZohoMail.messages.CREATE&client_id=1000.I6ZNQQJB3BARTHKXYP5O8M5ZSAFFSC&response_type=code&access_type=offline&redirect_uri=https://uddoktahut.com

// https://accounts.zoho.com/oauth/v2/auth?scope=ZohoMail.messages.CREATE&client_id=1000.I6ZNQQJB3BARTHKXYP5O8M5ZSAFFSC&response_type=code&access_type=offline&redirect_uri=https://uddoktahut.com
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

const sendEmailVarification = async (data) => {
  const { email, name, password } = data;
  const userExist = await User.findOne({ where: { email } });
  if (userExist) throw new Error("User already exist");

  const { hashedPassword } = await passwordHashing(password);
  const otp = generateOtp();
  saveOtp({ identifier: email, name, password: hashedPassword }, Number(otp));

  const tokenParams = new URLSearchParams({
    refresh_token: env.ZOHO_REFRESH_TOKEN,
    client_id: env.ZOHO_CLIENT_ID,
    client_secret: env.ZOHO_CLIENT_SECRET,
    grant_type: "refresh_token",
  });

  const tokenResp = await fetch("https://accounts.zoho.com/oauth/v2/token", {
    method: "POST",
    body: tokenParams,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const tokenData = await tokenResp.json();
  const accessToken = tokenData.access_token;

  // 2️⃣ Get Zoho account ID
  const accountId = env.ZOHO_ACCOUNT_ID;

  // 3️⃣ Prepare email content
  const subject = "Please verify your email";
  const content = `
      <main style="display: flex; flex-direction: column; margin: 0 auto">
        <p style="font-weight: 700; font-size: 20px">Welcome to UddoktaHut, ${name}</p>
        <p style="font-weight: 500; font-size: 16px">Your OTP is: <b>${otp}</b></p>
      </main>
    `;

  // 4️⃣ Send email
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

  const sendData = await sendResp.json();
  return sendData;
};

const verifyEmailToProceed = async (data) => {
  const { identifier, otp } = data;
  let record = verifyOtp(identifier, Number(otp));
  if (record) {
    const { name, password } = record;
    if (!name || !password) throw new Error("No name or password found!");
    const user = await User.create({ email: identifier, name, password });
    const userPayload = {
      id: user.id,
      email: user.email,
    };
    return generateTokens(userPayload, false);
  }
  return null;
};

const sendSmsProvider = async (data) => {
  const { phoneNumber, name, password } = data;

  const existUser = await User.findOne({
    where: { phone_number: phoneNumber },
  });
  if (existUser) throw new Error("User already exist");

  const { hashedPassword } = await passwordHashing(password);
  const otp = generateOtp();
  saveOtp(
    { identifier: phoneNumber, name, password: hashedPassword },
    Number(otp)
  );
  const response = await fetch(env.SMS_URL, {
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

const verifySmsProvider = async (data) => {
  const { identifier, otp } = data;
  let record = verifyOtp(identifier, Number(otp));
  if (record) {
    const { name, password } = record;
    if (!name || !password) throw new Error("No name or password found!");
    const user = await User.create({
      name,
      password,
      phone_number: identifier,
    });
    const userPayload = {
      id: user.id,
      phoneNumber: user.phone_number,
    };
    return generateTokens(userPayload, false);
  }
  return null;
};

const onboardedAccess = async (id) => {
  const user = await User.findOne({
    where: { id },
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

  return {
    name: user.name,
    email: user.email,
    phoneNumber: user.phone_number,
    onboarded: user.Roles[0]?.user_roles?.onboarded,
    role: user.Roles[0]?.user_roles?.role_id,
  };
};

async function validateUserAndRoles(userId, roles, transaction) {
  const [validUser, validRoles] = await Promise.all([
    User.findOne({ where: { id: userId }, transaction }),
    Role.findAll({ where: { id: roles }, transaction }),
  ]);

  if (!validUser) throw new Error("User is invalid");

  console.log(validRoles);
  console.log(roles);

  if (validRoles.length !== roles.length)
    throw new Error("Some roles are invalid");

  return { validUser, validRoles };
}

async function clearPreviousUserData(userId, transaction) {
  await Promise.all([
    UserRole.destroy({ where: { user_id: userId }, transaction }),
    Store.destroy({ where: { user_id: userId }, transaction }),
  ]);
}

async function createUserRoles(userId, roles, onboarded, transaction) {
  return await UserRole.bulkCreate(
    roles.map((roleId) => ({ user_id: userId, role_id: roleId, onboarded })),
    { transaction }
  );
}

async function createStoreAndSubscription(userId, storeData, transaction) {
  const store = await Store.create(
    { user_id: userId, ...storeData },
    { transaction }
  );

  const now = new Date();
  const trialEnds = new Date(now);
  trialEnds.setDate(now.getDate() + 7);

  await Subscription.create(
    {
      store_id: store.id,
      status: "trialing",
      start_date: now,
      trial_ends_at: trialEnds,
      end_date: trialEnds,
      is_auto_renew: false,
      plan_id: null,
    },
    { transaction }
  );

  return store;
}

function generateFinalTokenAfterOnboarded(validUser, roles, store, onboarded) {
  const payload = validUser.email
    ? {
        id: validUser.id,
        email: validUser.email,
        roles,
        storeName: store.store_name,
        storeAddress: store.store_address,
        storeType: store.store_type,
        storeUrl: store.store_url,
      }
    : {
        id: validUser.id,
        phoneNumber: validUser.phoneNumber,
        roles,
        storeName: store.store_name,
        storeAddress: store.store_address,
        storeType: store.store_type,
        storeUrl: store.store_url,
      };

  const tokens = generateTokens(payload, onboarded);
  return { tokens, onboarded };
}

const assignRoleToUserAndCreateStore = async (data) => {
  const { userId, roles, storeName, storeAddress, storeType } = data;
  const storeSlug = slugifyStoreName(storeName);
  if (!storeSlug) throw new Error("Invalid business name");

  const resolvedStoreUrl = buildStoreUrl(storeSlug);
  const transaction = await sequelize.transaction();

  try {
    const existStore = await Store.findOne({
      where: { store_name: storeSlug },
      transaction,
    });
    if (existStore) throw new Error("This (business/store) name already exist");

    const isAdmin = roles.includes(1);
    const onboarded = isAdmin;

    const { validUser } = await validateUserAndRoles(
      userId,
      roles,
      transaction
    );
    await clearPreviousUserData(validUser.id, transaction);

    const userRoles = await createUserRoles(
      validUser.id,
      roles,
      onboarded,
      transaction
    );
    const store = await createStoreAndSubscription(
      validUser.id,
      {
        store_name: storeSlug,
        store_address: storeAddress,
        store_type: storeType,
        store_url: resolvedStoreUrl,
      },
      transaction
    );

    await transaction.commit();

    const storePayload = {
      store_name: storeSlug,
      store_address: storeAddress,
      store_type: storeType,
      store_url: resolvedStoreUrl,
    };

    if (userRoles?.length && store)
      return generateFinalTokenAfterOnboarded(
        validUser,
        roles,
        storePayload,
        onboarded
      );
    return null;
  } catch (err) {
    await transaction.rollback();
    throw new Error(err.message);
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
