import { classifyQueryIntent } from "../vectorService.js";
import { queryWithContextStream } from "../provider.js";
import { throwError } from "../../../lib/throwError.js";
import { validateBusinessContext } from "../validation/questionValidator.js";
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

    const embedding = await getQuestionEmbedding(question);
    let dbResults = null;

    if (intent) {
      try {
        const { sqlQuery } = await resolveSQLFromEmbedding(
          embedding,
          question,
          storeName
        );
        dbResults = await fetchBusinessData(sqlQuery, storeName);
      } catch (error) {
        if (error.statusCode === 400) {
          return buildSecurityErrorResponse(error, storeName);
        }
        throw error;
      }
    }

    const stream = await queryWithContextStream({
      question,
      dbResults,
      storeName,
    });

    return {
      stream,
      metadata: { intent },
    };
  } catch (error) {
    if (error.statusCode) throw error;
    throwError(`RAG streaming failed: ${error.message}`, 500);
  }
};

export { processRAGQueryStream };
