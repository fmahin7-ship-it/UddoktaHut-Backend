import { env } from "../config/env.ts";

function slugifyStoreName(storeName: string): string {
  return storeName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildStoreUrl(slug: string): string {
  return env.isProd
    ? `https://${slug}.uddoktahut.com`
    : `http://${slug}.uddoktahut.local:3000`;
}

export { slugifyStoreName, buildStoreUrl };
