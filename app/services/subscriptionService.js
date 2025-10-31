import { throwError } from "../lib/throwError.js";
import {
  User,
  Role,
  UserRole,
  Store,
  Plan,
  Subscription,
} from "../models/RootModel.js";

function checkValidity(subscription, now) {
  return (
    (subscription.status === "trialing" &&
      new Date(subscription.trial_ends_at) > now) ||
    (subscription.status === "active" && new Date(subscription.end_date) > now)
  );
}

const getSubscriptionStatus = async ({ userId }) => {
  const user = await User.findOne({
    where: { id: userId },
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

  if (!user) throwError("Not authorized", 401);

  if (user.Store) {
    const subscription = await Subscription.findOne({
      where: { store_id: user.Store.id },
      include: [Plan],
    });

    if (!subscription) throw new Error("No subscription found");

    const now = new Date();
    const isActive = checkValidity(subscription, now);

    const userData = {
      name: user.name,
      email: user.email,
      phoneNumber: user.phone_number,
      onboarded: user.Roles[0]?.user_roles?.onboarded,
      role: user.Roles[0]?.user_roles?.role_id,
      template_name: user.Store.template_name,
      storeName: user.Store.store_name,
      storeUrl: user.Store.store_url,
    };

    user && (userData.isActive = isActive);
    return { user: userData };
  }
  const userData = {
    name: user.name,
    email: user.email,
    phoneNumber: user.phone_number,
    onboarded: user.Roles[0]?.user_roles?.onboarded,
    role: user.Roles[0]?.user_roles?.role_id,
  };

  return { user: userData };
};

const getSubscribedStore = async ({ storeName }) => {
  const store = await Store.findOne({ where: { store_name: storeName } });

  if (!store) return { storeData: null };

  const subscription = await Subscription.findOne({
    where: { store_id: store.id },
  });

  if (!subscription) return { store: null };

  const now = new Date();
  const isActive = checkValidity(subscription, now);

  const payload = {
    ...store.toJSON(),
    isActive,
  };
  return { storeData: payload };
};

export { getSubscriptionStatus, getSubscribedStore };
