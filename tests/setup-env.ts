/**
 * Loaded via `node --import ./tests/setup-env.ts` before tests.
 * Always prefer the dedicated test database unless overridden.
 */
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.DB_NAME_TEST = process.env.DB_NAME_TEST || "uddoktahut_test";
process.env.USE_TEST_DB = "true";
process.env.STRIPE_SECRET_KEY =
  process.env.STRIPE_SECRET_KEY || "sk_test_billing_handcheck";
process.env.STRIPE_PRICE_PRO =
  process.env.STRIPE_PRICE_PRO || "price_test_pro";
process.env.STRIPE_PRICE_BUSINESS =
  process.env.STRIPE_PRICE_BUSINESS || "price_test_business";
