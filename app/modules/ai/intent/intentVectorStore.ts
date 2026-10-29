import { queryExecute, querySelect } from "../../../db/sql.ts";
import { formatVectorLiteral } from "./constants.ts";

const findSimilarUtterances = async (
  embedding: number[],
  { limit, threshold }: { limit: number; threshold: number }
) =>
  querySelect<{
    tool_name: string;
    example_question: string;
    similarity: number;
  }>(
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
    { queryVector: formatVectorLiteral(embedding), threshold, limit }
  );

const countIntentUtterances = async () => {
  const rows = await querySelect<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM tool_routing`
  );
  return rows[0]?.count ?? 0;
};

const clearIntentUtterances = async () => {
  await queryExecute(`TRUNCATE tool_routing RESTART IDENTITY`);
};

const insertIntentUtterance = async ({
  example_question,
  tool_name,
  locale,
  embedding,
}: {
  example_question: string;
  tool_name: string;
  locale: string;
  embedding: number[];
}) => {
  const queryVector = formatVectorLiteral(embedding);

  await queryExecute(
    `
    INSERT INTO tool_routing (example_question, tool_name, locale, embedding)
    VALUES (:example_question, :tool_name, :locale, :queryVector::vector)
    `,
    {
      example_question,
      tool_name,
      locale: locale || "any",
      queryVector,
    }
  );
};

export {
  findSimilarUtterances,
  countIntentUtterances,
  clearIntentUtterances,
  insertIntentUtterance,
};
