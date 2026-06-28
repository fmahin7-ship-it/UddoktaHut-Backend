import { sequelize } from "../config/database.js";
import { DataTypes } from "sequelize";

const Plan = sequelize.define(
  "Plan",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    slug: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    name: { type: DataTypes.STRING, allowNull: false },
    billing_cycle: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.INTEGER, allowNull: false },
    max_products: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 20 },
    includes_ai: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    ai_token_limit_monthly: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "plans",
    timestamps: false,
  }
);

export default Plan;
