import { sequelize } from "../config/database.js";
import { DataTypes } from "sequelize";

const PlanPrice = sequelize.define(
  "PlanPrice",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    plan_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "plans", key: "id" },
    },
    market: { type: DataTypes.STRING(2), allowNull: false },
    currency: { type: DataTypes.STRING(3), allowNull: false },
    /** Minor currency unit (cents / poisha). */
    amount: { type: DataTypes.INTEGER, allowNull: false },
    gateway_price_id: { type: DataTypes.STRING, allowNull: true },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "plan_prices",
    timestamps: false,
    indexes: [{ unique: true, fields: ["plan_id", "market"] }],
  }
);

export default PlanPrice;
