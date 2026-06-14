import { env } from "../config/env.js";

function slugifyStoreName(storeName) {
  return storeName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildStoreUrl(slug) {
  return env.isProd
    ? `https://${slug}.uddoktahut.com`
    : `http://${slug}.uddoktahut.local:3000`;
}

export { slugifyStoreName, buildStoreUrl };
