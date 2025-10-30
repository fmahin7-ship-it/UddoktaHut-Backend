const finalPrompt = `Business Analyst: Answer based on this data.
                  Question: ${question}
                  Store ID: ${storeId}
                  Data: ${JSON.stringify(dbResults)}

                  Provide a helpful business analysis based on this data. Be concise and clear.
  `;

const databaseSchema = `
    Database Schema:
    
    1. stores table:
       - id (primary key)
       - user_id (foreign key to users)
       - store_name (varchar, unique)
       - store_url (varchar, unique)
       - store_type (varchar)
       - store_address (varchar, nullable)
       - template_name (varchar, default: 'default')
       - created_at (datetime)
    
    2. products table:
       - id (primary key)
       - name (varchar)
       - image (varchar, nullable)
       - price (float)
       - stock (integer)
       - status (varchar)
       - category (varchar)
       - sku (varchar)
       - user_id (integer)
       - store_id (foreign key to stores)
       - createdAt (datetime)
       - updatedAt (datetime)
    
    3. users table:
       - id (primary key)
       - email (varchar, unique, nullable)
       - phone_number (varchar, unique, nullable)
       - name (varchar)
       - password (varchar)
    
    4. subscriptions table:
       - id (primary key)
       - store_id (foreign key to stores)
       - status (varchar)
       - start_date (datetime)
       - trial_ends_at (datetime)
       - end_date (datetime)
       - is_auto_renew (boolean, default: false)
       - plan_id (foreign key to plans)
    
    5. plans table:
       - id (primary key)
       - name (varchar)
       - billing_cycle (varchar)
       - price (integer)
    `;

// AI prompt for SQL generation
const sqlPrompt = (question, safeStoreId) => `
    You are a SQL expert for an e-commerce business analytics system.
    
    ${databaseSchema}
    
    User Question: "${question}"
    Store ID: ${safeStoreId}
    
    CRITICAL SECURITY RULES - NEVER VIOLATE THESE:
    1. ALWAYS include "WHERE store_id = ${safeStoreId}" for any products table query
    2. ALWAYS include "WHERE id = ${safeStoreId}" for any stores table query  
    3. ALWAYS include "WHERE store_id = ${safeStoreId}" for any subscriptions table query
    4. NEVER allow queries that can access other users' data
    5. NEVER use WHERE clauses that could bypass store_id restrictions
    6. NEVER use OR conditions that might expose other stores' data
    7. NEVER query across multiple stores or users
    8. NEVER use subqueries that access other stores
    
    ADDITIONAL RULES:
    9. Only query tables that exist in the schema above
    10. Use proper JOIN syntax when connecting tables
    11. Return only SELECT queries (no INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE)
    12. Limit results to reasonable numbers (use LIMIT when appropriate)
    13. Handle cases where data might not exist (use LEFT JOIN, COALESCE when needed)
    14. Focus on business insights and analytics for THIS store only
    15. Never return more than 100 rows
    16. Never use dangerous SQL operations
    
    DATA ISOLATION EXAMPLES:
    - Products: "SELECT * FROM products WHERE store_id = ${safeStoreId}"
    - Store Info: "SELECT * FROM stores WHERE id = ${safeStoreId}"
    - Subscriptions: "SELECT * FROM subscriptions WHERE store_id = ${safeStoreId}"
    - Store Owner: "SELECT u.name FROM users u JOIN stores s ON u.id = s.user_id WHERE s.id = ${safeStoreId}"
    
    FORBIDDEN PATTERNS:
    - "WHERE store_id != ${safeStoreId}" ❌
    - "WHERE store_id IN (1,2,3)" ❌ 
    - "WHERE store_id > 0" ❌
    - Any query without store_id restriction ❌
    - Cross-store comparisons ❌
    
    Generate a single SQL query that answers the user's question for ONLY store ID ${safeStoreId}.
    Return ONLY the SQL query, no explanations.
    
    Examples for Store ID ${safeStoreId}:
    - "How many products do I have?" → SELECT COUNT(*) as total_products FROM products WHERE store_id = ${safeStoreId}
    - "Which products are running low?" → SELECT name, stock FROM products WHERE store_id = ${safeStoreId} AND stock < 10 ORDER BY stock ASC
    - "What's my store information?" → SELECT store_name, store_type, store_address FROM stores WHERE id = ${safeStoreId}
    - "My subscription status?" → SELECT status, start_date, end_date FROM subscriptions WHERE store_id = ${safeStoreId}
    
    SQL Query:
    `;

export { sqlPrompt, databaseSchema, finalPrompt };
