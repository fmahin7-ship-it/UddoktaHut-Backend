import { eq } from "drizzle-orm";
import { db } from "./client.ts";
import { users } from "./schema/index.ts";

/** Public session shape — never includes password. */
export type SessionUser = {
  id: number;
  email: string | null;
  phone_number: string | null;
  name: string;
  Roles: Array<{
    id: number;
    role_name: string;
    user_roles?: { onboarded: boolean; role_id: number };
  }>;
  Store?: {
    id: number;
    store_name: string;
    store_url: string;
    store_address: string | null;
    store_type: string;
    country: string;
    template_name: string | null;
    user_id: number;
  } | null;
};

/** Login-only shape — password present for bcrypt compare. */
export type LoginUser = SessionUser & { password: string };

/** @deprecated Prefer SessionUser / LoginUser */
export type SequelizeShapedUser = LoginUser;

const loadUserGraph = async (userId: number) =>
  db.query.users.findFirst({
    where: eq(users.id, userId),
    with: {
      roleAssignments: { with: { role: true } },
      store: true,
    },
  });

type UserGraphRow = NonNullable<Awaited<ReturnType<typeof loadUserGraph>>>;

const mapSessionUser = (row: UserGraphRow): SessionUser => ({
  id: row.id,
  email: row.email,
  phone_number: row.phone_number,
  name: row.name,
  Roles: (row.roleAssignments ?? []).map((ur) => ({
    id: ur.role.id,
    role_name: ur.role.role_name,
    user_roles: { onboarded: ur.onboarded, role_id: ur.role_id },
  })),
  Store: row.store ?? null,
});

const mapLoginUser = (row: UserGraphRow): LoginUser => ({
  ...mapSessionUser(row),
  password: row.password,
});

export const findUserByIdWithRolesAndStore = async (
  userId: number
): Promise<SessionUser | null> => {
  const row = await loadUserGraph(userId);
  return row ? mapSessionUser(row) : null;
};

export const findUserForLogin = async (params: {
  email?: string;
  phone_number?: string;
}): Promise<LoginUser | null> => {
  const where = params.email
    ? eq(users.email, params.email)
    : eq(users.phone_number, params.phone_number!);

  const row = await db.query.users.findFirst({
    where,
    with: {
      roleAssignments: { with: { role: true } },
      store: true,
    },
  });
  return row ? mapLoginUser(row) : null;
};
