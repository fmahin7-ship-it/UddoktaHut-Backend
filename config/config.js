import { buildDatabaseConfig } from "../app/config/databaseConfig.js";

export default {
  development: buildDatabaseConfig("development"),
  production: buildDatabaseConfig("production"),
};
