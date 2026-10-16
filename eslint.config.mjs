import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Hermeneutical guardrail (see config/hermeneutics.ts). Keep these rules in sync with
// HERMENEUTICS.forbiddenPackages; tests/hermeneutics.test.ts verifies they are present.
const AI_PACKAGES = [
  "openai",
  "@anthropic-ai/*",
  "ai",
  "@ai-sdk/*",
  "langchain",
  "@langchain/*",
  "llamaindex",
  "@google/generative-ai",
  "@google/genai",
  "@mistralai/*",
  "cohere-ai",
  "ollama",
  "replicate",
  "@huggingface/*",
];
const AI_MESSAGE = "AI/LLM packages are forbidden: this app never generates study content (config/hermeneutics.ts).";

const DB_MODULES = ["@/lib/db/client", "better-sqlite3", "drizzle-orm/better-sqlite3"];
const DB_MESSAGE = "Read study data through lib/queries/ only, so every read stays inside config/hermeneutics.ts verifiedTables.";

const FETCH_MESSAGE = "Use getStudyData() from @/lib/api, which enforces config/hermeneutics.ts.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    name: "hermeneutics/no-ai-packages",
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: AI_PACKAGES, message: AI_MESSAGE }] }],
    },
  },
  {
    name: "hermeneutics/db-only-in-queries",
    files: ["app/**", "components/**", "lib/**", "config/**"],
    ignores: ["lib/queries/**", "lib/db/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [{ group: AI_PACKAGES, message: AI_MESSAGE }],
          paths: DB_MODULES.map((name) => ({ name, message: DB_MESSAGE })),
        },
      ],
    },
  },
  {
    name: "hermeneutics/guarded-fetch",
    files: ["app/**", "components/**", "lib/**"],
    ignores: ["lib/api.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        ...["fetch", "XMLHttpRequest", "WebSocket", "EventSource"].map((name) => ({ name, message: FETCH_MESSAGE })),
      ],
      "no-restricted-properties": [
        "error",
        ...["window", "globalThis", "self"].map((object) => ({ object, property: "fetch", message: FETCH_MESSAGE })),
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
