import type { OwnerStoreContext } from "../modules/subscriptions/ownerContext.ts";

export type ProductUsage = {
  used: number;
  limit: number;
  remaining: number;
};

export type AiUsage = {
  used: number;
  limit: number;
  remaining: number;
  estimated?: number;
};

export type AuthUser = {
  id: number;
  email?: string | null;
  phone_number?: string | null;
  name: string;
  Roles?: Array<{
    id: number;
    role_name: string;
    user_roles?: { onboarded: boolean; role_id: number };
  }>;
  Store?: {
    id: number;
    store_name: string;
    store_url?: string;
    country?: string;
    user_id?: number;
  } | null;
  country?: string | null;
  storeUrl?: string | null;
  onboarded?: boolean;
};

export type { OwnerStoreContext };

declare global {
  namespace Express {
    interface User extends AuthUser {}
    interface Request {
      ownerStoreContext?: OwnerStoreContext;
      productUsage?: ProductUsage;
      aiUsage?: AiUsage;
    }
  }
}

export {};
