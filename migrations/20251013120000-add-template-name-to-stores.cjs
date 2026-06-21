"use strict";

const { columnExists } = require("./helpers/schemaChecks.cjs");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (await columnExists(queryInterface, "stores", "template_name")) {
      return;
    }

    await queryInterface.addColumn("stores", "template_name", {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: "classic",
    });
  },

  async down(queryInterface) {
    if (!(await columnExists(queryInterface, "stores", "template_name"))) {
      return;
    }
    await queryInterface.removeColumn("stores", "template_name");
  },
};
