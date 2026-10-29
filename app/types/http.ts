import type { Request, RequestHandler } from "express";
import type { OwnerStoreContext } from "../modules/subscriptions/ownerContext.ts";
import type { AiUsage, AuthUser, ProductUsage } from "./express.d.ts";

export type AuthenticatedRequest = Request & {
  user: AuthUser;
  ownerStoreContext?: OwnerStoreContext;
  productUsage?: ProductUsage;
  aiUsage?: AiUsage;
};

export type MaybeAuthRequest = Request & {
  user?: AuthUser;
  ownerStoreContext?: OwnerStoreContext;
  productUsage?: ProductUsage;
  aiUsage?: AiUsage;
};

/** Express-compatible handler; async is fine at runtime. */
export type AsyncRoute = RequestHandler;

export type AsyncAuthRoute = RequestHandler;
