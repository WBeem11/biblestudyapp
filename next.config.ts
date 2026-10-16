import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Pin the root: a stray lockfile in a parent directory otherwise confuses inference.
  outputFileTracingRoot: import.meta.dirname,
  // Ship the read-only SQLite database with every server function on Vercel.
  outputFileTracingIncludes: {
    "/**": ["./data/bible.db"],
  },
  turbopack: {
    root: import.meta.dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
