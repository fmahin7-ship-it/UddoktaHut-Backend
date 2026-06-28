"use strict";

const PLANS = [
  {
    id: 1,
    slug: "trial",
    name: "Free Trial",
    billing_cycle: "trial",
    price: 0,
    max_products: 20,
    includes_ai: false,
    ai_token_limit_monthly: 0,
  },
  {
    id: 2,
    slug: "basic",
    name: "Basic",
    billing_cycle: "monthly",
    price: 500,
    max_products: 300,
    includes_ai: false,
    ai_token_limit_monthly: 0,
  },
  {
    id: 3,
    slug: "pro",
    name: "Pro",
    billing_cycle: "monthly",
    price: 2500,
    max_products: 700,
    includes_ai: true,
    ai_token_limit_monthly: 10000,
  },
  {
    id: 4,
    slug: "business",
    name: "Business",
    billing_cycle: "monthly",
    price: 4000,
    max_products: 2000,
    includes_ai: true,
    ai_token_limit_monthly: 50000,
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("plans");

    if (!table.slug) {
      await queryInterface.addColumn("plans", "slug", {
        type: Sequelize.STRING(50),
        allowNull: true,
        unique: true,
      });
    }
    if (!table.max_products) {
      await queryInterface.addColumn("plans", "max_products", {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 20,
      });
    }
    if (!table.includes_ai) {
      await queryInterface.addColumn("plans", "includes_ai", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
    if (!table.ai_token_limit_monthly) {
      await queryInterface.addColumn("plans", "ai_token_limit_monthly", {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }

    for (const plan of PLANS) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM plans WHERE id = :id OR slug = :slug LIMIT 1`,
        {
          replacements: { id: plan.id, slug: plan.slug },
          type: Sequelize.QueryTypes.SELECT,
        }
      );

      if (existing) {
        await queryInterface.sequelize.query(
          `UPDATE plans SET
            slug = :slug,
            name = :name,
            billing_cycle = :billing_cycle,
            price = :price,
            max_products = :max_products,
            includes_ai = :includes_ai,
            ai_token_limit_monthly = :ai_token_limit_monthly
          WHERE id = :id`,
          { replacements: { ...plan, id: existing.id } }
        );
      } else {
        await queryInterface.bulkInsert("plans", [plan]);
      }
    }

    await queryInterface.sequelize.query(`
      UPDATE subscriptions
      SET plan_id = 1
      WHERE plan_id IS NULL AND status = 'trialing'
    `);
    await queryInterface.sequelize.query(`
      UPDATE subscriptions
      SET plan_id = 2
      WHERE plan_id IS NULL AND status = 'active'
    `);

    const aiUsageExists = await queryInterface
      .showAllTables()
      .then((tables) => tables.includes("ai_usage_monthly"));

    if (!aiUsageExists) {
      await queryInterface.createTable("ai_usage_monthly", {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        store_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "stores", key: "id" },
          onDelete: "CASCADE",
        },
        period: {
          type: Sequelize.STRING(7),
          allowNull: false,
          comment: "YYYY-MM billing period",
        },
        tokens_used: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      });

      await queryInterface.addIndex("ai_usage_monthly", ["store_id", "period"], {
        unique: true,
        name: "ai_usage_monthly_store_period_unique",
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ai_usage_monthly");
    await queryInterface.removeColumn("plans", "ai_token_limit_monthly");
    await queryInterface.removeColumn("plans", "includes_ai");
    await queryInterface.removeColumn("plans", "max_products");
    await queryInterface.removeColumn("plans", "slug");
  },
};
