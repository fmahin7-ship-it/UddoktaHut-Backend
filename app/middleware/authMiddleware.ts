import { env } from "../config/env.ts";
import passport from "passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { findUserByIdWithRolesAndStore } from "../db/userQueries.ts";

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: env.JWT_SECRET,
};

passport.use(
  new Strategy(jwtOptions, async (jwt_payload, done) => {
    try {
      const user = await findUserByIdWithRolesAndStore(jwt_payload.id);
      if (!user) return done(null, false);
      return done(null, user);
    } catch (error) {
      done(error as Error, false);
    }
  })
);
const authenticateUser = passport.authenticate("jwt", {
  session: false,
});

const initializePassport = () => {
  passport.initialize();
};

export { authenticateUser, initializePassport };
