"use strict";

const { tableExists, columnExists, indexExists } = require("./helpers/schemaChecks.cjs");

const SUBSCRIPTION_COLUMNS = {
  stripe_customer_id: { type: "STRING", allowNull: true },
  stripe_subscription_id: { type: "STRING", allowNull: true },
  billing_provider: { type: "STRING", allowNull: true },
  cancel_at_period_end: { type: "BOOLEAN", allowNull: false, defaultValue: false },
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    for (const [name, column] of Object.entries(SUBSCRIPTION_COLUMNS)) {
      if (await columnExists(queryInterface, "subscriptions", name)) continue;
      const type =
        column.type === "BOOLEAN" ? Sequelize.BOOLEAN : Sequelize.STRING;
      await queryInterface.addColumn("subscriptions", name, {
        type,
        allowNull: column.allowNull,
        defaultValue: column.defaultValue,
      });
    }

    if (
      !(await indexExists(queryInterface, "subscriptions", [
        "stripe_customer_id",
      ]))
    ) {
      await queryInterface.addIndex("subscriptions", ["stripe_customer_id"], {
        unique: true,
        name: "subscriptions_stripe_customer_id_unique",
      });
    }
    if (
      !(await indexExists(queryInterface, "subscriptions", [
        "stripe_subscription_id",
      ]))
    ) {
      await queryInterface.addIndex(
        "subscriptions",
        ["stripe_subscription_id"],
        {
          unique: true,
          name: "subscriptions_stripe_subscription_id_unique",
        }
      );
    }

    if (!(await tableExists(queryInterface, "billing_webhook_events"))) {
      await queryInterface.createTable("billing_webhook_events", {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        provider: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: "stripe",
        },
        event_id: { type: Sequelize.STRING, allowNull: false },
        event_type: { type: Sequelize.STRING, allowNull: false },
        payload_json: { type: Sequelize.JSONB, allowNull: true },
        processed_at: { type: Sequelize.DATE, allowNull: true },
        error: { type: Sequelize.TEXT, allowNull: true },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("NOW()"),
        },
      });
      await queryInterface.addIndex(
        "billing_webhook_events",
        ["provider", "event_id"],
        {
          unique: true,
          name: "billing_webhook_events_provider_event_id_unique",
        }
      );
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, "billing_webhook_events")) {
      await queryInterface.dropTable("billing_webhook_events");
    }

    for (const name of [
      "subscriptions_stripe_subscription_id_unique",
      "subscriptions_stripe_customer_id_unique",
    ]) {
      try {
        await queryInterface.removeIndex("subscriptions", name);
      } catch {
        // Index already removed.
      }
    }

    for (const name of Object.keys(SUBSCRIPTION_COLUMNS)) {
      if (await columnExists(queryInterface, "subscriptions", name)) {
        await queryInterface.removeColumn("subscriptions", name);
      }
    }
  },
};
