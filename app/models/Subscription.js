import { sequelize } from "../config/database.js";
import { DataTypes } from "sequelize";

const Subscription = sequelize.define(
  "Subscription",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    store_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "stores", key: "id" },
    },
    status: { type: DataTypes.STRING },
    start_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    trial_ends_at: { type: DataTypes.DATE },
    end_date: { type: DataTypes.DATE },
    is_auto_renew: { type: DataTypes.BOOLEAN, defaultValue: false },
    plan_id: {
      type: DataTypes.INTEGER,
      references: { model: "plans", key: "id" },
      allowNull: true,
    },
    stripe_customer_id: { type: DataTypes.STRING, allowNull: true },
    stripe_subscription_id: { type: DataTypes.STRING, allowNull: true },
    /** 'stripe' once billed through Stripe; null for trial and manual plans. */
    billing_provider: { type: DataTypes.STRING, allowNull: true },
    /** True after cancel: stay on the plan until end_date, then do not renew. */
    cancel_at_period_end: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "subscriptions",
    timestamps: false,
  }
);

export default Subscription;
