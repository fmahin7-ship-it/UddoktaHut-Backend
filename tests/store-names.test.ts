import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isReservedStoreSlug,
  slugifyStoreName,
} from "../app/utils/storeUrl.ts";
import { assignRoleToUserAndCreateStore } from "../app/modules/users/users.service.ts";

test("platform subdomains are reserved, normal shop names are not", () => {
  for (const name of ["www", "api", "backend", "admin", "app", "uddoktahut"]) {
    assert.equal(isReservedStoreSlug(name), true, name);
  }
  for (const name of ["rahim-shop", "backend-fashion", "my-app-store"]) {
    assert.equal(isReservedStoreSlug(name), false, name);
  }
});

test("reserved check runs on the slug, so case and spaces cannot bypass it", () => {
  assert.equal(isReservedStoreSlug(slugifyStoreName("  BackEnd ")), true);
  assert.equal(isReservedStoreSlug(slugifyStoreName("A.P.I")), true);
});

const onboard = (storeName: string) =>
  assignRoleToUserAndCreateStore({
    userId: 1,
    roles: [1],
    storeName,
    storeAddress: "",
    storeType: "fashion",
    country: "BD",
  });

test("onboarding rejects a reserved store name with a 409", async () => {
  await assert.rejects(onboard("Backend"), (err: Error & { statusCode?: number }) => {
    assert.equal(err.statusCode, 409);
    assert.match(err.message, /isn't available/);
    return true;
  });
});

test("onboarding rejects a store name longer than a subdomain allows", async () => {
  await assert.rejects(onboard("a".repeat(64)), (err: Error & { statusCode?: number }) => {
    assert.equal(err.statusCode, 400);
    return true;
  });
});
