import { QueryTypes } from "sequelize";
import { sequelize } from "../../config/database.js";

// Vector similarity search using PostgreSQL
const searchSimilarQueries = async (queryEmbedding, options = {}) => {
  const { limit = 5, threshold = 0.7 } = options;

  try {
    // For now, we'll use a simple pattern matching approach
    // Later we can add pgvector extension for true vector similarity
    const similarQueries = await sequelize.query(
      `
      SELECT 
        id,
        query_text,
        sql_template,
        intent_category,
        1.0 as similarity
      FROM query_patterns 
      WHERE similarity_threshold <= :threshold
      ORDER BY id DESC
      LIMIT :limit
    `,
      {
        replacements: { threshold, limit },
        type: QueryTypes.SELECT,
      }
    );
    return similarQueries;
  } catch (error) {
    return getDefaultQueryPatterns();
  }
};

const getDefaultQueryPatterns = () => {
  return [
    {
      id: 1,
      query_text: "store information",
      sql_template:
        "SELECT store_name, store_type, store_address, template_name, created_at FROM stores WHERE store_name = '{storeName}'",
      intent_category: "store_info",
      similarity: 0.5,
    },
    {
      id: 2,
      query_text: "product analysis",
      sql_template:
        "SELECT COUNT(*) as total_products, COUNT(CASE WHEN status = 'Active' THEN 1 END) as active_products, AVG(price) as avg_price FROM products p JOIN stores s ON p.store_id = s.id WHERE s.store_name = '{storeName}'",
      intent_category: "product_analysis",
      similarity: 0.8,
    },
    {
      id: 3,
      query_text: "business overview",
      sql_template:
        "SELECT s.store_name, s.store_type, COUNT(p.id) as total_products FROM stores s LEFT JOIN products p ON s.id = p.store_id WHERE s.store_name = '{storeName}' GROUP BY s.id, s.store_name, s.store_type",
      intent_category: "business_overview",
      similarity: 0.85,
    },
    {
      id: 4,
      query_text: "owner information",
      sql_template:
        "SELECT u.name, u.email, s.store_name FROM users u JOIN stores s ON u.id = s.user_id WHERE s.store_name = '{storeName}'",
      intent_category: "owner_info",
      similarity: 0.8,
    },
  ];
};

const generateSQLFromVector = (vectorMatches, storeName) => {
  const bestMatch = vectorMatches[0];
  return bestMatch.sql_template.replace("{storeName}", storeName);
};

const classifyQueryIntent = (question) => {
  const lowerQuestion = question.toLowerCase();

  if (
    lowerQuestion.includes("পণ্য") ||
    lowerQuestion.includes("product") ||
    lowerQuestion.includes("inventory") ||
    lowerQuestion.includes("stock") ||
    lowerQuestion.includes("স্টক") ||
    lowerQuestion.includes("item")
  ) {
    if (
      lowerQuestion.includes("list") ||
      lowerQuestion.includes("show") ||
      lowerQuestion.includes("তালিকা") ||
      lowerQuestion.includes("দেখাও")
    ) {
      return "product_inventory";
    }
    return "product_analysis";
  }

  if (
    lowerQuestion.includes("owner") ||
    lowerQuestion.includes("account") ||
    lowerQuestion.includes("user") ||
    lowerQuestion.includes("মালিক") ||
    lowerQuestion.includes("অ্যাকাউন্ট")
  ) {
    return "owner_info";
  }

  if (
    lowerQuestion.includes("business") ||
    lowerQuestion.includes("overview") ||
    lowerQuestion.includes("ব্যবসা") ||
    lowerQuestion.includes("সামগ্রিক") ||
    lowerQuestion.includes("overall") ||
    lowerQuestion.includes("summary")
  ) {
    return "business_overview";
  }

  if (
    lowerQuestion.includes("দোকান") ||
    lowerQuestion.includes("store") ||
    lowerQuestion.includes("তথ্য") ||
    lowerQuestion.includes("information")
  ) {
    return "store_info";
  }

  return null;
};

// Store new query patterns (for future learning)
const storeQueryPattern = async (queryText, sqlTemplate, intentCategory) => {
  try {
    await sequelize.query(
      `
      INSERT INTO query_patterns (query_text, sql_template, intent_category, similarity_threshold)
      VALUES (:queryText, :sqlTemplate, :intentCategory, 0.8)
    `,
      {
        replacements: { queryText, sqlTemplate, intentCategory },
        type: QueryTypes.INSERT,
      }
    );
  } catch (error) {
    // Silently fail if table doesn't exist
    console.log("Query pattern storage skipped - table not found");
  }
};

export {
  searchSimilarQueries,
  generateSQLFromVector,
  classifyQueryIntent,
  storeQueryPattern,
};
