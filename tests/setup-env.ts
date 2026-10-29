/**
 * Loaded via `node --import ./tests/setup-env.ts` before tests.
 * Always prefer the dedicated test database unless overridden.
 */
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.DB_NAME_TEST = process.env.DB_NAME_TEST || "uddoktahut_test";
process.env.USE_TEST_DB = "true";
