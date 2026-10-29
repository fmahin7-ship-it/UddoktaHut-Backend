import type { Request } from "express";
import type { AuthUser } from "../types/express.d.ts";
import { assertFound } from "./throwError.ts";

/** After authenticateUser middleware, require a logged-in user. */
export const requireUser = (req: Request): AuthUser => {
  const user = req.user;
  assertFound(user, "Unauthorized", 401);
  return user;
};
