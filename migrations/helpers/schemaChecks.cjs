"use strict";

/** @param {import('sequelize').QueryInterface} queryInterface */
async function columnExists(queryInterface, tableName, columnName) {
  const table = await queryInterface.describeTable(tableName);
  return Object.prototype.hasOwnProperty.call(table, columnName);
}

/** @param {import('sequelize').QueryInterface} queryInterface */
async function indexExists(queryInterface, tableName, fields) {
  const indexes = await queryInterface.showIndex(tableName);
  const target = [...fields].sort().join(",");
  return indexes.some((index) => {
    const indexFields = index.fields
      .map((field) => field.attribute || field.name)
      .sort()
      .join(",");
    return indexFields === target;
  });
}

module.exports = {
  columnExists,
  indexExists,
};
