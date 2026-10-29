import { env } from "../config/env.ts";

/** A DNS label (one subdomain part) can be at most 63 characters. */
const MAX_STORE_SLUG_LENGTH = 63;

/**
 * Subdomains UddoktaHut keeps for itself. A store slug becomes
 * `<slug>.uddoktahut.com`, so a seller must never be able to claim these.
 */
const RESERVED_STORE_SLUGS: ReadonlySet<string> = new Set([
  "www",
  "api",
  "backend",
  "admin",
  "app",
  "dashboard",
  "mail",
  "email",
  "smtp",
  "ftp",
  "help",
  "support",
  "status",
  "blog",
  "docs",
  "cdn",
  "static",
  "assets",
  "images",
  "media",
  "files",
  "billing",
  "pay",
  "payment",
  "payments",
  "checkout",
  "account",
  "accounts",
  "auth",
  "login",
  "signup",
  "register",
  "store",
  "stores",
  "shop",
  "dev",
  "staging",
  "test",
  "demo",
  "uddoktahut",
]);

function slugifyStoreName(storeName: string): string {
  return storeName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isReservedStoreSlug(slug: string): boolean {
  return RESERVED_STORE_SLUGS.has(slug);
}

function buildStoreUrl(slug: string): string {
  return env.isProd
    ? `https://${slug}.uddoktahut.com`
    : `http://${slug}.uddoktahut.local:3000`;
}

export {
  slugifyStoreName,
  isReservedStoreSlug,
  buildStoreUrl,
  MAX_STORE_SLUG_LENGTH,
  RESERVED_STORE_SLUGS,
};
