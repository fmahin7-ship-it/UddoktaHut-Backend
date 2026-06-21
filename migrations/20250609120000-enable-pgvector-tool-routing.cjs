"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `CREATE EXTENSION IF NOT EXISTS vector;`
    );

    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS tool_routing (
        id SERIAL PRIMARY KEY,
        example_question TEXT NOT NULL,
        tool_name VARCHAR(64) NOT NULL,
        locale VARCHAR(8) NOT NULL DEFAULT 'any',
        embedding vector(1536) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS tool_routing_embedding_idx
      ON tool_routing
      USING hnsw (embedding vector_cosine_ops);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DROP INDEX IF EXISTS tool_routing_embedding_idx;`
    );
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS tool_routing;`);
    // Extension left installed — shared DB may use it elsewhere.
  },
};
