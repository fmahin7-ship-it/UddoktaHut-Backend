"use strict";

const { indexExists } = require("./helpers/schemaChecks.cjs");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const indexes = [
      ["name"],
      ["category"],
      ["sku"],
    ];

    for (const fields of indexes) {
      if (await indexExists(queryInterface, "products", fields)) {
        continue;
      }
      await queryInterface.addIndex("products", fields);
    }
  },

  async down(queryInterface) {
    const indexes = [
      ["name"],
      ["category"],
      ["sku"],
    ];

    for (const fields of indexes) {
      if (!(await indexExists(queryInterface, "products", fields))) {
        continue;
      }
      await queryInterface.removeIndex("products", fields);
    }
  },
};
