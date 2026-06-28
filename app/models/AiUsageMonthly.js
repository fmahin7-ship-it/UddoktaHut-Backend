import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const AiUsageMonthly = sequelize.define(
  "AiUsageMonthly",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    store_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    period: {
      type: DataTypes.STRING(7),
      allowNull: false,
    },
    tokens_used: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "ai_usage_monthly",
    timestamps: false,
  }
);

export default AiUsageMonthly;
