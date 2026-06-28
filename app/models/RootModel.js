import { sequelize } from "../config/database.js";
import { env } from "../config/env.js";
import Role from "./Role.js";
import User from "./User.js";
import UserRole from "./UserRole.js";
import Store from "./Store.js";
import Subscription from "./Subscription.js";
import Plan from "./Plan.js";
import Product from "./Product.js";
import Order from "./Order.js";
import OrderItem from "./OrderItem.js";
import OrderReturn from "./OrderReturn.js";
import OrderReturnItem from "./OrderReturnItem.js";
import AiUsageMonthly from "./AiUsageMonthly.js";

// USER_ROLE (MANY TO MANY)
User.belongsToMany(Role, {
  through: UserRole,
  foreignKey: "user_id",
  onDelete: "CASCADE",
});
Role.belongsToMany(User, {
  through: UserRole,
  foreignKey: "role_id",
  onDelete: "CASCADE",
});

// PRODUCT (ONE TO MANY)
User.hasMany(Product, {
  foreignKey: "user_id",
  onDelete: "CASCADE",
});
Product.belongsTo(User, {
  foreignKey: "user_id",
  onDelete: "CASCADE",
});

// PRODUCT (STORE RELATION)
Store.hasMany(Product, {
  foreignKey: "store_id",
  onDelete: "CASCADE",
});
Product.belongsTo(Store, {
  foreignKey: "store_id",
  onDelete: "CASCADE",
});

User.hasOne(Store, {
  foreignKey: "user_id",
});

Store.belongsTo(User, {
  foreignKey: "user_id",
  onDelete: "CASCADE",
});

Plan.hasMany(Subscription, { foreignKey: "plan_id" });
Subscription.belongsTo(Plan, { foreignKey: "plan_id" });

Store.hasOne(Subscription, { foreignKey: "store_id" });
Subscription.belongsTo(Store, {
  foreignKey: "store_id",
  onDelete: "CASCADE",
});

Store.hasMany(AiUsageMonthly, { foreignKey: "store_id", onDelete: "CASCADE" });
AiUsageMonthly.belongsTo(Store, { foreignKey: "store_id", onDelete: "CASCADE" });

Store.hasMany(Order, { foreignKey: "store_id", onDelete: "CASCADE" });
Order.belongsTo(Store, { foreignKey: "store_id", onDelete: "CASCADE" });

Order.hasMany(OrderItem, { foreignKey: "order_id", onDelete: "CASCADE" });
OrderItem.belongsTo(Order, { foreignKey: "order_id", onDelete: "CASCADE" });
OrderItem.belongsTo(Product, { foreignKey: "product_id" });
Product.hasMany(OrderItem, { foreignKey: "product_id" });

Order.hasMany(OrderReturn, { foreignKey: "order_id", onDelete: "CASCADE" });
OrderReturn.belongsTo(Order, { foreignKey: "order_id", onDelete: "CASCADE" });
Store.hasMany(OrderReturn, { foreignKey: "store_id", onDelete: "CASCADE" });
OrderReturn.belongsTo(Store, { foreignKey: "store_id", onDelete: "CASCADE" });

OrderReturn.hasMany(OrderReturnItem, {
  foreignKey: "return_id",
  onDelete: "CASCADE",
});
OrderReturnItem.belongsTo(OrderReturn, {
  foreignKey: "return_id",
  onDelete: "CASCADE",
});
OrderReturnItem.belongsTo(OrderItem, {
  foreignKey: "order_item_id",
  onDelete: "CASCADE",
});
OrderItem.hasMany(OrderReturnItem, {
  foreignKey: "order_item_id",
  onDelete: "CASCADE",
});

const syncSequlizeBasedOnEnvironment = async () => {
  await sequelize.authenticate();
  console.log("✅ Database connected successfully.");
  switch (env.NODE_ENV) {
    case "development":
      // await sequelize.sync({ force: true });
      break;
    case "staging":
      // await sequelize.sync({ alter: true }); // ⚠️ Keeps data but may be slow
      await sequelize.sync({ force: true });
      break;
    case "production":
      // await sequelize.sync({ force: true });
      console.log("✅ Running in production mode, use migrations!");
      break;
    default:
      console.log("✅ Running in default mode!");
  }
  console.log("✅ Database synced successfully.");
};

export {
  syncSequlizeBasedOnEnvironment,
  sequelize,
  User,
  Role,
  UserRole,
  Store,
  Subscription,
  Plan,
  Product,
  Order,
  OrderItem,
  OrderReturn,
  OrderReturnItem,
  AiUsageMonthly,
};
