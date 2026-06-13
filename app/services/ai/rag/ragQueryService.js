import { classifyQueryIntent } from "../vectorService.js";
import { queryWithContextStream } from "../provider.js";
import { throwError } from "../../../lib/throwError.js";
import { validateBusinessContext } from "../validation/questionValidator.js";
import { generateSmartBusinessSQL } from "../sql/sqlGenerator.js";
import { fetchBusinessData } from "../sql/sqlExecutor.js";
import {
  buildSecurityErrorResponse,
  buildValidationErrorResponse,
} from "./queryResponse.js";
import { getQuestionEmbedding, resolveSQLFromEmbedding } from "./embeddingResolver.js";

const processRAGQueryStream = async (question, storeName) => {
  try {
    const intent = classifyQueryIntent(question);
    const validation = validateBusinessContext(question);

    if (!validation.isValid) {
      return buildValidationErrorResponse(validation);
    }

    let dbResults = null;
    let sqlQuery = null;

    try {
      if (intent) {
        const embedding = await getQuestionEmbedding(question);
        ({ sqlQuery } = await resolveSQLFromEmbedding(
          embedding,
          question,
          storeName
        ));
      } else {
        sqlQuery = await generateSmartBusinessSQL(question, storeName);
      }

      dbResults = await fetchBusinessData(sqlQuery, storeName);
    } catch (error) {
      if (error.statusCode === 400) {
        return buildSecurityErrorResponse(error, storeName);
      }
      throw error;
    }

    const stream = await queryWithContextStream({
      question,
      dbResults,
      storeName,
      sqlQuery,
    });

    return {
      stream,
      metadata: { intent, sqlQuery },
    };
  } catch (error) {
    if (error.statusCode) throw error;
    throwError(`RAG streaming failed: ${error.message}`, 500);
  }
};

export { processRAGQueryStream };
