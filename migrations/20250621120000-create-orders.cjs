"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("orders", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      store_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "stores", key: "id" },
        onDelete: "CASCADE",
      },
      order_number: {
        type: Sequelize.STRING(32),
        allowNull: false,
        unique: true,
      },
      customer_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      customer_phone: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      customer_address: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: "pending",
      },
      payment_method: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: "cod",
      },
      payment_status: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: "unpaid",
      },
      subtotal: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      total: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.createTable("order_items", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      order_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "orders", key: "id" },
        onDelete: "CASCADE",
      },
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "products", key: "id" },
        onDelete: "RESTRICT",
      },
      product_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      unit_price: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      line_total: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.createTable("order_returns", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      order_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "orders", key: "id" },
        onDelete: "CASCADE",
      },
      store_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "stores", key: "id" },
        onDelete: "CASCADE",
      },
      status: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: "requested",
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      merchant_note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      refund_status: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: "none",
      },
      refund_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.createTable("order_return_items", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      return_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "order_returns", key: "id" },
        onDelete: "CASCADE",
      },
      order_item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "order_items", key: "id" },
        onDelete: "CASCADE",
      },
      quantity_returned: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      restock: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex("orders", ["store_id", "created_at"], {
      name: "orders_store_id_created_at_idx",
    });
    await queryInterface.addIndex("orders", ["store_id", "status"], {
      name: "orders_store_id_status_idx",
    });
    await queryInterface.addIndex("order_items", ["order_id"], {
      name: "order_items_order_id_idx",
    });
    await queryInterface.addIndex("order_returns", ["order_id"], {
      name: "order_returns_order_id_idx",
    });
    await queryInterface.addIndex("order_returns", ["store_id", "status"], {
      name: "order_returns_store_id_status_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("order_return_items");
    await queryInterface.dropTable("order_returns");
    await queryInterface.dropTable("order_items");
    await queryInterface.dropTable("orders");
  },
};
