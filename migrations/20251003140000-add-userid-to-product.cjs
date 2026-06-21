"use strict";

const { columnExists } = require("./helpers/schemaChecks.cjs");

module.exports = {
  async up(queryInterface, Sequelize) {
    if (await columnExists(queryInterface, "products", "user_id")) {
      return;
    }

    await queryInterface.addColumn("products", "user_id", {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  },
  async down(queryInterface) {
    if (!(await columnExists(queryInterface, "products", "user_id"))) {
      return;
    }
    await queryInterface.removeColumn("products", "user_id");
  },
};
