"use strict";

const { columnExists } = require("./helpers/schemaChecks.cjs");

module.exports = {
  async up(queryInterface, Sequelize) {
    if (await columnExists(queryInterface, "products", "store_id")) {
      return;
    }

    await queryInterface.addColumn("products", "store_id", {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "stores",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  },
  async down(queryInterface) {
    if (!(await columnExists(queryInterface, "products", "store_id"))) {
      return;
    }
    await queryInterface.removeColumn("products", "store_id");
  },
};
