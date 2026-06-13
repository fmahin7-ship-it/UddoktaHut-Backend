import { env } from "../config/env.js";
import { throwError } from "../lib/throwError.js";

function resolveAIStoreContext(req) {
  if (env.AI_DEV_BYPASS) {
    const storeName =
      req.headers["x-store-name"] ||
      req.user?.Store?.store_name ||
      env.AI_DEV_DEFAULT_STORE;

    if (!storeName) {
      throwError(
        "Dev AI bypass: send x-store-name, log in with JWT, or set AI_DEV_DEFAULT_STORE in .env",
        400
      );
    }
    return storeName;
  }

  if (req.headers["x-store-name"]) {
    console.warn(
      env.isDev
        ? "[AI dev] x-store-name ignored; set AI_DEV_BYPASS=true to use it"
        : "[AI] x-store-name ignored in production"
    );
  }

  const storeName = req.user?.Store?.store_name;
  if (!storeName) {
    throwError("Store not found for authenticated user", 403);
  }
  return storeName;
}

export { resolveAIStoreContext };
