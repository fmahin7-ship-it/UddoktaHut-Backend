import { env } from "../config/env.ts";
import { assertFound } from "../lib/throwError.ts";
import type { MaybeAuthRequest } from "../types/http.ts";

function resolveAIStoreContext(req: MaybeAuthRequest): string {
  if (env.AI_DEV_BYPASS) {
    const headerStore = req.headers["x-store-name"];
    const storeName =
      (typeof headerStore === "string" ? headerStore : undefined) ||
      req.user?.Store?.store_name ||
      env.AI_DEV_DEFAULT_STORE;

    assertFound(
      storeName,
      "Dev AI bypass: send x-store-name, log in with JWT, or set AI_DEV_DEFAULT_STORE in .env",
      400
    );
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
  assertFound(storeName, "Store not found for authenticated user", 403);
  return storeName;
}

export { resolveAIStoreContext };
