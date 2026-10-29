import { defineConfig } from "tsup";

/** Production bundles — plain Node, no experimental strip-types. */
export default defineConfig({
  entry: ["main.ts", "migrate.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  external: [
    "bcrypt",
    "pg",
    "pg-native",
    "sharp",
    "geoip-country",
  ],
});
