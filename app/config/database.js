import { Sequelize } from "sequelize";
import { buildDatabaseConfig } from "./databaseConfig.js";

const databaseConfig = buildDatabaseConfig();
const { username, password, database, ...options } = databaseConfig;

const sequelize = new Sequelize(database, username, password, options);

export { sequelize };
