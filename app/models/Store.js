import { sequelize } from "../config/database.js";
import { DataTypes } from "sequelize";

const Store = sequelize.define(
  "Store",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id: {
      type: DataTypes.INTEGER,
      references: {
        model: "users",
        key: "id",
      },
      allowNull: false,
    },
    store_name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    store_url: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    store_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    store_address: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING(2),
      allowNull: false,
      defaultValue: "BD",
    },
    template_name: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "default",
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "stores",
    timestamps: false,
  }
);

export default Store;
