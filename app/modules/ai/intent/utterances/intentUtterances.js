/**
 * Intent utterances per tool — embeddings generated at seed time.
 * Add English + Bengali phrasings; matched by semantic similarity, not exact text.
 */
const INTENT_UTTERANCES = [
  // get_store_summary
  {
    tool_name: "get_store_summary",
    example_question: "Tell me about my store",
    locale: "en",
  },
  {
    tool_name: "get_store_summary",
    example_question: "What is my shop information?",
    locale: "en",
  },
  {
    tool_name: "get_store_summary",
    example_question: "আমার দোকানের তথ্য দাও",
    locale: "bn",
  },
  {
    tool_name: "get_store_summary",
    example_question: "Store profile and details",
    locale: "en",
  },
  {
    tool_name: "get_store_summary",
    example_question: "amar dokaner name ki",
    locale: "bn",
  },
  {
    tool_name: "get_store_summary",
    example_question: "amar dokan er naam ki",
    locale: "bn",
  },
  {
    tool_name: "get_store_summary",
    example_question: "What is my store name",
    locale: "en",
  },

  // get_product_stats
  {
    tool_name: "get_product_stats",
    example_question: "How many products do I have?",
    locale: "en",
  },
  {
    tool_name: "get_product_stats",
    example_question: "Product overview and totals",
    locale: "en",
  },
  {
    tool_name: "get_product_stats",
    example_question: "কতগুলো পণ্য আছে?",
    locale: "bn",
  },
  {
    tool_name: "get_product_stats",
    example_question: "আমার কতগুলো প্রোডাক্ট আছে?",
    locale: "bn",
  },
  {
    tool_name: "get_product_stats",
    example_question: "আমার কতগুলো পণ্য আছে?",
    locale: "bn",
  },
  {
    tool_name: "get_product_stats",
    example_question: "Average price and stock summary",
    locale: "en",
  },

  // list_products
  {
    tool_name: "list_products",
    example_question: "Show me my products",
    locale: "en",
  },
  {
    tool_name: "list_products",
    example_question: "List all items in my catalog",
    locale: "en",
  },
  {
    tool_name: "list_products",
    example_question: "আমার পণ্যের তালিকা দেখাও",
    locale: "bn",
  },
  {
    tool_name: "list_products",
    example_question: "Highest priced products",
    locale: "en",
  },

  // get_low_stock_products
  {
    tool_name: "get_low_stock_products",
    example_question: "Which products need restocking soon?",
    locale: "en",
  },
  {
    tool_name: "get_low_stock_products",
    example_question: "Low stock items",
    locale: "en",
  },
  {
    tool_name: "get_low_stock_products",
    example_question: "What is running out of stock?",
    locale: "en",
  },
  {
    tool_name: "get_low_stock_products",
    example_question: "কোন পণ্য রিস্টক দরকার?",
    locale: "bn",
  },
  {
    tool_name: "get_low_stock_products",
    example_question: "কম স্টকের পণ্য",
    locale: "bn",
  },

  // get_categories_breakdown
  {
    tool_name: "get_categories_breakdown",
    example_question: "Breakdown by category",
    locale: "en",
  },
  {
    tool_name: "get_categories_breakdown",
    example_question: "What's the best pricing strategy for my store?",
    locale: "en",
  },
  {
    tool_name: "get_categories_breakdown",
    example_question: "Average price per category",
    locale: "en",
  },
  {
    tool_name: "get_categories_breakdown",
    example_question: "ক্যাটাগরি অনুযায়ী পণ্য",
    locale: "bn",
  },
  {
    tool_name: "get_categories_breakdown",
    example_question: "Which category has the most products?",
    locale: "en",
  },

  // get_order_summary
  {
    tool_name: "get_order_summary",
    example_question: "How much did I sell this week?",
    locale: "en",
  },
  {
    tool_name: "get_order_summary",
    example_question: "Total revenue this month",
    locale: "en",
  },
  {
    tool_name: "get_order_summary",
    example_question: "How many orders today?",
    locale: "en",
  },
  {
    tool_name: "get_order_summary",
    example_question: "Sales summary for my store",
    locale: "en",
  },
  {
    tool_name: "get_order_summary",
    example_question: "এই মাসে কত বিক্রি হয়েছে?",
    locale: "bn",
  },
  {
    tool_name: "get_order_summary",
    example_question: "আজ কয়টা অর্ডার এসেছে?",
    locale: "bn",
  },
  {
    tool_name: "get_order_summary",
    example_question: "গত ৭ দিনের বিক্রি",
    locale: "bn",
  },

  // get_recent_orders
  {
    tool_name: "get_recent_orders",
    example_question: "Show my latest orders",
    locale: "en",
  },
  {
    tool_name: "get_recent_orders",
    example_question: "Recent customer orders",
    locale: "en",
  },
  {
    tool_name: "get_recent_orders",
    example_question: "Any new orders?",
    locale: "en",
  },
  {
    tool_name: "get_recent_orders",
    example_question: "Pending orders list",
    locale: "en",
  },
  {
    tool_name: "get_recent_orders",
    example_question: "সাম্প্রতিক অর্ডার দেখাও",
    locale: "bn",
  },
  {
    tool_name: "get_recent_orders",
    example_question: "নতুন অর্ডার আছে?",
    locale: "bn",
  },

  // get_top_selling_products
  {
    tool_name: "get_top_selling_products",
    example_question: "Best selling products",
    locale: "en",
  },
  {
    tool_name: "get_top_selling_products",
    example_question: "What are my top products by sales?",
    locale: "en",
  },
  {
    tool_name: "get_top_selling_products",
    example_question: "Which items sold the most this month?",
    locale: "en",
  },
  {
    tool_name: "get_top_selling_products",
    example_question: "সবচেয়ে বেশি বিক্রি হওয়া পণ্য",
    locale: "bn",
  },
  {
    tool_name: "get_top_selling_products",
    example_question: "কোন পণ্য সবচেয়ে বেশি বিক্রি হয়েছে?",
    locale: "bn",
  },

  // get_returns_summary
  {
    tool_name: "get_returns_summary",
    example_question: "How many returns do I have?",
    locale: "en",
  },
  {
    tool_name: "get_returns_summary",
    example_question: "Return and refund summary",
    locale: "en",
  },
  {
    tool_name: "get_returns_summary",
    example_question: "Pending return requests",
    locale: "en",
  },
  {
    tool_name: "get_returns_summary",
    example_question: "Total refunded amount",
    locale: "en",
  },
  {
    tool_name: "get_returns_summary",
    example_question: "রিটার্ন কতগুলো হয়েছে?",
    locale: "bn",
  },
  {
    tool_name: "get_returns_summary",
    example_question: "রিফান্ডের হিসাব দেখাও",
    locale: "bn",
  },
  {
    tool_name: "get_returns_summary",
    example_question: "কোন অর্ডার রিটার্ন চাচ্ছে?",
    locale: "bn",
  },
];

export { INTENT_UTTERANCES };
