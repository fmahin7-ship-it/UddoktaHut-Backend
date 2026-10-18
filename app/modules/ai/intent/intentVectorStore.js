import { QueryTypes } from "sequelize";
import { sequelize } from "../../../config/database.js";
import { formatVectorLiteral } from "./constants.js";

const findSimilarUtterances = async (embedding, { limit, threshold }) => {
  const queryVector = formatVectorLiteral(embedding);

  return sequelize.query(
    `
    SELECT
      tool_name,
      example_question,
      1 - (embedding <=> :queryVector::vector) AS similarity
    FROM tool_routing
    WHERE 1 - (embedding <=> :queryVector::vector) >= :threshold
    ORDER BY embedding <=> :queryVector::vector
    LIMIT :limit
    `,
    {
      replacements: { queryVector, threshold, limit },
      type: QueryTypes.SELECT,
    }
  );
};

const countIntentUtterances = async () => {
  const rows = await sequelize.query(
    `SELECT COUNT(*)::int AS count FROM tool_routing`,
    { type: QueryTypes.SELECT }
  );
  return rows[0]?.count ?? 0;
};

const clearIntentUtterances = async () => {
  await sequelize.query(`TRUNCATE tool_routing RESTART IDENTITY`, {
    type: QueryTypes.RAW,
  });
};

const insertIntentUtterance = async ({
  example_question,
  tool_name,
  locale,
  embedding,
}) => {
  const queryVector = formatVectorLiteral(embedding);

  await sequelize.query(
    `
    INSERT INTO tool_routing (example_question, tool_name, locale, embedding)
    VALUES (:example_question, :tool_name, :locale, :queryVector::vector)
    `,
    {
      replacements: {
        example_question,
        tool_name,
        locale: locale || "any",
        queryVector,
      },
      type: QueryTypes.INSERT,
    }
  );
};

export {
  findSimilarUtterances,
  countIntentUtterances,
  clearIntentUtterances,
  insertIntentUtterance,
};
