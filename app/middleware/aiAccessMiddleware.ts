import passport from "passport";
import { env } from "../config/env.ts";
import type { AuthUser } from "../types/express.d.ts";
import type { AsyncRoute } from "../types/http.ts";
import { authenticateUser } from "./authMiddleware.ts";

const attachUserIfPresent: AsyncRoute = (req, res, next) => {
  passport.authenticate(
    "jwt",
    { session: false },
    (err: Error | null, user: AuthUser | false | undefined) => {
      if (err) {
        next(err);
        return;
      }
      if (user) req.user = user;
      next();
    }
  )(req, res, next);
};

const aiQueryAuth: AsyncRoute = (req, res, next) => {
  if (env.AI_DEV_BYPASS) {
    attachUserIfPresent(req, res, next);
    return;
  }
  authenticateUser(req, res, next);
};

export { aiQueryAuth };
