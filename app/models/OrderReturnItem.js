import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const OrderReturnItem = sequelize.define(
  "OrderReturnItem",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    return_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    order_item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    quantity_returned: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    restock: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "order_return_items",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

export default OrderReturnItem;
