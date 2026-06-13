import passport from "passport";
import { env } from "../config/env.js";
import { authenticateUser } from "./authMiddleware.js";

function attachUserIfPresent(req, res, next) {
  passport.authenticate("jwt", { session: false }, (err, user) => {
    if (err) return next(err);
    if (user) req.user = user;
    next();
  })(req, res, next);
}

const aiQueryAuth = (req, res, next) => {
  if (env.AI_DEV_BYPASS) {
    return attachUserIfPresent(req, res, next);
  }
  return authenticateUser(req, res, next);
};

export { aiQueryAuth };
