import {
  searchSimilarQueries,
  generateSQLFromVector,
  classifyQueryIntent,
} from "./vectorService.js";
import { queryOllamaStream, queryWithContextStream } from "./ollamaService.js";
import { QueryTypes } from "sequelize";
import { generateEmbedding } from "./embeddingService.js";
import { sequelize } from "../../config/database.js";
import { throwError } from "../../lib/throwError.js";
import {
  allowedContexts,
  blockedContexts,
  forbidden,
} from "../../utils/constant.js";
import { sqlPrompt } from "../../utils/prompt.js";

const processRAGQueryStream = async (question, storeId) => {
  try {
    const validation = validateBusinessContext(question);

    if (!validation.isValid) {
      return {
        stream: { body: createErrorStream(validation.message) },
        metadata: {
          intent: "error",
          sqlQuery: null,
          errorType: validation.errorType,
        },
      };
    }

    const embedding = await getQuestionEmbedding(question);

    const { sqlQuery, intent } = await getSQLFromEmbedding(
      embedding,
      question,
      storeId
    );

    const dbResults = await getBusinessData(sqlQuery, storeId);

    // Return the stream directly from queryWithContext (which now calls queryOllamaStream)
    const stream = await queryWithContextStream({
      question,
      dbResults,
      storeId,
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

const processSimpleQueryStream = async (question, storeId) => {
  try {
    const validation = validateBusinessContext(question);

    if (!validation.isValid) {
      // Return error as a stream instead of throwing
      return {
        stream: { body: createErrorStream(validation.message) },
        metadata: {
          intent: "error",
          sqlQuery: null,
          errorType: validation.errorType,
          type: "simple",
        },
      };
    }

    const sqlQuery = await generateSmartBusinessSQL(question, storeId);

    const dbResults = await getBusinessData(sqlQuery, storeId);

    // Return the stream directly from queryWithContextStream (which calls queryOllamaStream)
    const stream = await queryWithContextStream({
      question,
      dbResults,
      storeId,
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

const getQuestionEmbedding = async (question) => {
  try {
    return await generateEmbedding(question);
  } catch (error) {
    throwError(`Embedding generation failed: ${error.message}`, 503);
  }
};

const getSQLFromEmbedding = async (embedding, question, storeId) => {
  try {
    const vectorMatches = await searchSimilarQueries(embedding, {
      limit: 3,
      threshold: 0.7,
    });

    if (
      vectorMatches &&
      vectorMatches.length > 0 &&
      vectorMatches[0].similarity > 0.7
    ) {
      return {
        sqlQuery: generateSQLFromVector(vectorMatches, storeId),
        intent: vectorMatches[0].intent_category,
      };
    }

    // Fallback if no good vector match - use AI instead of hardcoded
    const sqlQuery = await generateSmartBusinessSQL(question, storeId);
    const intent = classifyQueryIntent(question);
    return {
      sqlQuery,
      intent,
    };
  } catch (error) {
    throwError(`SQL generation failed: ${error.message}`, 500);
  }
};

const getBusinessData = async (sqlQuery, storeId) => {
  try {
    return await executeSecureSQL(sqlQuery, storeId);
  } catch (error) {
    throwError(`Data retrieval failed: ${error.message}`, 500);
  }
};

const executeSecureSQL = async (sqlQuery, storeId) => {
  try {
    if (!sqlQuery || typeof sqlQuery !== "string") {
      throwError("Invalid SQL query", 400);
    }

    if (!sqlQuery.includes(storeId.toString())) {
      throwError("Query must include store ID for security", 400);
    }

    const results = await Promise.race([
      sequelize.query(sqlQuery, { type: QueryTypes.SELECT }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Query timeout")), 5000)
      ),
    ]);

    return results;
  } catch (error) {
    if (error.message === "Query timeout") {
      throwError("Database query timed out", 408);
    }
    throwError(`Database query failed: ${error.message}`, 500);
  }
};

// Create a streaming error response that looks like a real stream
const createErrorStream = (message) => {
  const encoder = new TextEncoder();
  let index = 0;
  const words = message.split(" ");

  const stream = new ReadableStream({
    start(controller) {
      const sendNextWord = () => {
        if (index < words.length) {
          const word = words[index] + (index < words.length - 1 ? " " : "");
          const chunk = JSON.stringify({ response: word }) + "\n";
          controller.enqueue(encoder.encode(chunk));
          index++;
          setTimeout(sendNextWord, 50); // Delay between words for streaming effect
        } else {
          // Send done signal
          const doneChunk = JSON.stringify({ response: "", done: true }) + "\n";
          controller.enqueue(encoder.encode(doneChunk));
          controller.close();
        }
      };
      sendNextWord();
    },
  });

  return {
    getReader: () => stream.getReader(),
  };
};

const validateBusinessContext = (question) => {
  const lowerQuestion = question.toLowerCase();

  for (const blocked of blockedContexts) {
    if (lowerQuestion.includes(blocked)) {
      return {
        isValid: false,
        errorType: "security",
        message: `I can't help with that request as it contains restricted content. Please ask questions about your business, store, products, or account information instead.`,
      };
    }
  }

  const hasAllowedContext = allowedContexts.some((context) =>
    lowerQuestion.includes(context)
  );

  if (!hasAllowedContext) {
    return {
      isValid: false,
      errorType: "context",
      message: `I can only help with questions related to your business, store, products, or account information. Please ask something about your store operations, inventory, or business analytics.`,
    };
  }

  return { isValid: true };
};

const generateSmartBusinessSQL = async (question, storeId) => {
  try {
    const safeStoreId = parseInt(storeId);
    if (!safeStoreId || safeStoreId <= 0) {
      throw new Error("Invalid store ID");
    }

    const response = await queryOllamaStream(
      sqlPrompt(question, safeStoreId),
      "llama3.1:8b",
      false
    );

    const data = await response.json();
    const sqlContent = data.response || "";

    let sqlMatch = sqlContent.match(/SELECT[\s\S]*?(?:;|$)/i);

    if (sqlMatch) {
      let cleanSQL = sqlMatch[0].trim().replace(/;$/, "");
      const upperSQL = cleanSQL.toUpperCase();
      const lowerSQL = cleanSQL.toLowerCase();

      for (const word of forbidden) {
        if (upperSQL.includes(word)) {
          throwError(`Forbidden SQL operation detected: ${word}`, 400);
        }
      }

      const securityThreats = [
        `store_id != ${safeStoreId}`,
        `store_id <> ${safeStoreId}`,
        "store_id in (",
        "store_id > 0",
        "store_id >= 1",
        "store_id is not null",
        "1=1",
        "true",
        "or store_id",
        "union select",
        "where 1",
        "; select",
        "-- ",
        "/*",
      ];

      for (const threat of securityThreats) {
        if (lowerSQL.includes(threat.toLowerCase())) {
          throwError(
            `Security violation detected: Query may access unauthorized data`,
            400
          );
        }
      }

      if (!upperSQL.startsWith("SELECT")) {
        throwError("Only SELECT queries are allowed", 400);
      }

      if (!cleanSQL.includes(safeStoreId.toString())) {
        throwError(
          "Query must include the specific store ID for security",
          400
        );
      }

      if (!upperSQL.includes("LIMIT")) {
        cleanSQL += " LIMIT 100";
      }

      return cleanSQL;
    }
    throwError("No valid SQL query found in AI response", 500);
  } catch (error) {
    if (error.statusCode) throw error;
    throwError(`Smart SQL generation failed: ${error.message}`, 500);
  }
};

export { processRAGQueryStream, processSimpleQueryStream };
