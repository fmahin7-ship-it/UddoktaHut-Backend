import { env } from "../config/env.ts";
import { connectDatabase } from "./client.ts";

export const syncDatabaseOnBoot = async (): Promise<void> => {
  await connectDatabase();
  console.log("✅ Database connected successfully.");

  switch (env.NODE_ENV) {
    case "development":
      break;
    case "staging":
      console.log(
        "⚠️ Staging: run `npm run db:migrate` or `npm run db:sync-dev` to apply schema."
      );
      break;
    case "production":
      console.log("✅ Running in production mode, use migrations!");
      break;
    default:
      console.log("✅ Running in default mode!");
  }

  console.log("✅ Database ready.");
};
