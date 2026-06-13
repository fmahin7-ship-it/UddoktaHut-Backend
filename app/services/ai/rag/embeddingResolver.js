import { generateEmbedding } from "../provider.js";
import {
  searchSimilarQueries,
  generateSQLFromVector,
} from "../vectorService.js";
import { throwError } from "../../../lib/throwError.js";
import { generateSmartBusinessSQL } from "../sql/sqlGenerator.js";

const VECTOR_MATCH_THRESHOLD = 0.7;
const VECTOR_MATCH_LIMIT = 3;

const getQuestionEmbedding = async (question) => {
  try {
    return await generateEmbedding(question);
  } catch (error) {
    throwError(`Embedding generation failed: ${error.message}`, 503);
  }
};

const resolveSQLFromEmbedding = async (embedding, question, storeName) => {
  try {
    const vectorMatches = await searchSimilarQueries(embedding, {
      limit: VECTOR_MATCH_LIMIT,
      threshold: VECTOR_MATCH_THRESHOLD,
    });

    if (
      vectorMatches?.length > 0 &&
      vectorMatches[0].similarity > VECTOR_MATCH_THRESHOLD
    ) {
      return {
        sqlQuery: generateSQLFromVector(vectorMatches, storeName),
        intent: vectorMatches[0].intent_category,
      };
    }

    const sqlQuery = await generateSmartBusinessSQL(question, storeName);
    return { sqlQuery };
  } catch (error) {
    if (error.statusCode) throw error;
    throwError(`SQL generation failed: ${error.message}`, 500);
  }
};

export { getQuestionEmbedding, resolveSQLFromEmbedding };
