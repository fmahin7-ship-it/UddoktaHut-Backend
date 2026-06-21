import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const OrderReturn = sequelize.define(
  "OrderReturn",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    store_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "requested",
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    merchant_note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    refund_status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "none",
    },
    refund_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
  },
  {
    tableName: "order_returns",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default OrderReturn;
