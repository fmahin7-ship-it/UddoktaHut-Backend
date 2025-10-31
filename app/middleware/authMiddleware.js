import { env } from "../config/env.js";
import passport from "passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Role, User, Store } from "../models/RootModel.js";

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: env.JWT_SECRET,
};

passport.use(
  new Strategy(jwtOptions, async (jwt_payload, done) => {
    try {
      const user = await User.findByPk(jwt_payload.id, {
        include: [
          { model: Role, through: { attributes: [] } },
          { model: Store, attributes: ["id", "store_name"] },
        ],
      });
      if (!user) return done(null, false);
      return done(null, user.toJSON());
    } catch (error) {
      done(error, false);
    }
  })
);
const authenticateUser = passport.authenticate("jwt", {
  session: false,
});

// const authorizeRoles = (roles) => (req, res, next) => {
//   if (
//     req.user &&
//     !req.user.Roles.some((role) => roles.includes(role.role_name))
//   ) {
//     return res
//       .status(403)
//       .json({ message: "Forbidden: Insufficient Permissions" });
//   }
//   next();
// };

const initializePassport = () => {
  passport.initialize();
};

export { authenticateUser, initializePassport };
