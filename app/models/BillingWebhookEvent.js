import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

/** One row per payment-provider event, so a retried webhook cannot be applied twice. */
const BillingWebhookEvent = sequelize.define(
  "BillingWebhookEvent",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    provider: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "stripe",
    },
    event_id: { type: DataTypes.STRING, allowNull: false },
    event_type: { type: DataTypes.STRING, allowNull: false },
    payload_json: { type: DataTypes.JSONB, allowNull: true },
    processed_at: { type: DataTypes.DATE, allowNull: true },
    error: { type: DataTypes.TEXT, allowNull: true },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "billing_webhook_events",
    timestamps: false,
    indexes: [{ unique: true, fields: ["provider", "event_id"] }],
  }
);

export default BillingWebhookEvent;
