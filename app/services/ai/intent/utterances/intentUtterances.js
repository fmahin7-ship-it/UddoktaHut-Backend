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
];

export { INTENT_UTTERANCES };
