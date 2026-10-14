"use strict";

const { tableExists, columnExists } = require("./helpers/schemaChecks.cjs");

/** Amounts are in the currency's minor unit (cents / poisha), matching Stripe. */
const PLAN_PRICES = [
  { slug: "trial", market: "BD", currency: "BDT", amount: 0 },
  { slug: "basic", market: "BD", currency: "BDT", amount: 50000 },
  { slug: "pro", market: "BD", currency: "BDT", amount: 150000 },
  { slug: "business", market: "BD", currency: "BDT", amount: 400000 },
  { slug: "trial", market: "AU", currency: "AUD", amount: 0 },
  { slug: "basic", market: "AU", currency: "AUD", amount: 1500 },
  { slug: "pro", market: "AU", currency: "AUD", amount: 3900 },
  { slug: "business", market: "AU", currency: "AUD", amount: 9900 },
];

const AI_TOKEN_LIMITS = { pro: 200000, business: 1000000 };
const PREVIOUS_AI_TOKEN_LIMITS = { pro: 10000, business: 50000 };

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "plan_prices"))) {
      await queryInterface.createTable("plan_prices", {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        plan_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "plans", key: "id" },
          onDelete: "CASCADE",
        },
        market: {
          type: Sequelize.STRING(2),
          allowNull: false,
          comment: "ISO 3166-1 alpha-2 market code (BD, AU)",
        },
        currency: {
          type: Sequelize.STRING(3),
          allowNull: false,
          comment: "ISO 4217 currency code",
        },
        amount: {
          type: Sequelize.INTEGER,
          allowNull: false,
          comment: "Price in the currency's minor unit",
        },
        gateway_price_id: {
          type: Sequelize.STRING,
          allowNull: true,
          comment: "Payment gateway price reference, e.g. Stripe price_...",
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
      });

      await queryInterface.addIndex("plan_prices", ["plan_id", "market"], {
        unique: true,
        name: "plan_prices_plan_market_unique",
      });
    }

    for (const price of PLAN_PRICES) {
      await queryInterface.sequelize.query(
        `INSERT INTO plan_prices (plan_id, market, currency, amount)
         SELECT id, :market, :currency, :amount FROM plans WHERE slug = :slug
         ON CONFLICT (plan_id, market)
         DO UPDATE SET currency = EXCLUDED.currency, amount = EXCLUDED.amount`,
        { replacements: price }
      );
    }

    if (!(await columnExists(queryInterface, "stores", "country"))) {
      await queryInterface.addColumn("stores", "country", {
        type: Sequelize.STRING(2),
        allowNull: false,
        defaultValue: "BD",
      });
    }

    for (const [slug, limit] of Object.entries(AI_TOKEN_LIMITS)) {
      await queryInterface.sequelize.query(
        `UPDATE plans SET ai_token_limit_monthly = :limit WHERE slug = :slug`,
        { replacements: { slug, limit } }
      );
    }
  },

  async down(queryInterface) {
    for (const [slug, limit] of Object.entries(PREVIOUS_AI_TOKEN_LIMITS)) {
      await queryInterface.sequelize.query(
        `UPDATE plans SET ai_token_limit_monthly = :limit WHERE slug = :slug`,
        { replacements: { slug, limit } }
      );
    }

    if (await columnExists(queryInterface, "stores", "country")) {
      await queryInterface.removeColumn("stores", "country");
    }

    if (await tableExists(queryInterface, "plan_prices")) {
      await queryInterface.dropTable("plan_prices");
    }
  },
};
