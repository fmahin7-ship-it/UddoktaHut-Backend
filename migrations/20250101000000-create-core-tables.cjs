"use strict";

/** @param {import('sequelize').QueryInterface} queryInterface */
async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.some(
    (table) => String(table).toLowerCase() === tableName.toLowerCase()
  );
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "users"))) {
      await queryInterface.createTable("users", {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        email: {
          type: Sequelize.STRING,
          allowNull: true,
          unique: true,
        },
        phone_number: {
          type: Sequelize.STRING,
          allowNull: true,
          unique: true,
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        password: {
          type: Sequelize.STRING,
          allowNull: false,
        },
      });
    }

    if (!(await tableExists(queryInterface, "roles"))) {
      await queryInterface.createTable("roles", {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        role_name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
      });

      await queryInterface.bulkInsert("roles", [
        { id: 1, role_name: "admin" },
        { id: 2, role_name: "employee" },
      ]);
    }

    if (!(await tableExists(queryInterface, "user_roles"))) {
      await queryInterface.createTable("user_roles", {
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "users", key: "id" },
          onDelete: "CASCADE",
        },
        role_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "roles", key: "id" },
          onDelete: "CASCADE",
        },
        onboarded: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
        },
      });

      await queryInterface.addConstraint("user_roles", {
        fields: ["user_id", "role_id"],
        type: "primary key",
        name: "user_roles_pkey",
      });
    }

    if (!(await tableExists(queryInterface, "stores"))) {
      await queryInterface.createTable("stores", {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "users", key: "id" },
          onDelete: "CASCADE",
        },
        store_name: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
        },
        store_url: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
        },
        store_type: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        store_address: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      });
    }

    if (!(await tableExists(queryInterface, "plans"))) {
      await queryInterface.createTable("plans", {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        billing_cycle: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        price: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
      });
    }

    if (!(await tableExists(queryInterface, "subscriptions"))) {
      await queryInterface.createTable("subscriptions", {
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
        status: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        start_date: {
          type: Sequelize.DATE,
          allowNull: true,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        trial_ends_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        end_date: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        is_auto_renew: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        plan_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: "plans", key: "id" },
          onDelete: "SET NULL",
        },
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable("subscriptions");
    await queryInterface.dropTable("plans");
    await queryInterface.dropTable("stores");
    await queryInterface.dropTable("user_roles");
    await queryInterface.dropTable("roles");
    await queryInterface.dropTable("users");
  },
};
