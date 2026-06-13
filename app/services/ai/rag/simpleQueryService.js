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

const processSimpleQueryStream = async (question, storeName) => {
  try {
    const validation = validateBusinessContext(question);

    if (!validation.isValid) {
      return buildValidationErrorResponse(validation, { type: "simple" });
    }

    let sqlQuery;
    let dbResults;

    try {
      sqlQuery = await generateSmartBusinessSQL(question, storeName);
      dbResults = await fetchBusinessData(sqlQuery, storeName);
    } catch (error) {
      if (error.statusCode === 400) {
        return buildSecurityErrorResponse(error, storeName, { type: "simple" });
      }
      throw error;
    }

    const stream = await queryWithContextStream({
      question,
      dbResults,
      storeName,
      sqlQuery,
    });

    const intent = classifyQueryIntent(question);

    return {
      stream,
      metadata: { intent, sqlQuery, type: "simple" },
    };
  } catch (error) {
    throwError(`Simple query streaming failed: ${error.message}`, 500);
  }
};

export { processSimpleQueryStream };
