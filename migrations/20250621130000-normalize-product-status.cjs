"use strict";

/** Normalize legacy product status values to lowercase active/inactive. */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE products
      SET status = LOWER(status)
      WHERE status IN ('Active', 'Inactive', 'ACTIVE', 'INACTIVE');
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE products
      SET status = INITCAP(status)
      WHERE status IN ('active', 'inactive');
    `);
  },
};
