import fs from "node:fs";
import path from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";
import {
  HERMENEUTICS,
  HermeneuticsViolation,
  assertAllowedApiPath,
  assertVerifiedTables,
  isForbiddenPackage,
} from "@/config/hermeneutics";

const ROOT = path.join(import.meta.dirname, "..");
const DB = path.join(ROOT, "data", "bible.db");

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true, recursive: true })
    .filter((d) => d.isFile() && /\.(ts|tsx|js|jsx|mjs)$/.test(d.name))
    .map((d) => path.relative(ROOT, path.join(d.parentPath, d.name)));
}

describe("hermeneutics config", () => {
  it("disallows all generated content and external fetches", () => {
    expect(HERMENEUTICS.principle).toBe("Scriptura sui ipsius interpres");
    expect(Object.values(HERMENEUTICS.generativeContent).every((v) => v === false)).toBe(true);
    expect(HERMENEUTICS.network.externalFetch).toBe(false);
    expect(HERMENEUTICS.curatedModules.fetchAtRuntime).toBe(false);
    expect(HERMENEUTICS.curatedModules.storeArticleText).toBe(false);
  });

  it("is frozen at runtime", () => {
    expect(Object.isFrozen(HERMENEUTICS)).toBe(true);
    expect(Object.isFrozen(HERMENEUTICS.verifiedTables)).toBe(true);
    expect(() => {
      (HERMENEUTICS.generativeContent as { aiSummaries: boolean }).aiSummaries = true;
    }).toThrow(TypeError);
  });

  it("rejects external and unlisted API paths", () => {
    expect(() => assertAllowedApiPath("/api/crossrefs/43003016?t=BSB")).not.toThrow();
    for (const bad of ["https://example.com/api", "//evil.test/x", "/api/summarize", "/api/crossrefs/abc"]) {
      expect(() => assertAllowedApiPath(bad)).toThrow(HermeneuticsViolation);
    }
  });

  it("rejects unverified database tables", () => {
    expect(() => assertVerifiedTables(["verses", "__drizzle_migrations", "verse_fts_data"])).not.toThrow();
    expect(() => assertVerifiedTables(["verses", "ai_commentary"])).toThrow(/ai_commentary/);
  });
});

describe("hermeneutics enforcement", () => {
  it("has no forbidden AI packages installed", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter(isForbiddenPackage)).toEqual([]);
    expect(isForbiddenPackage("openai")).toBe(true);
    expect(isForbiddenPackage("@anthropic-ai/sdk")).toBe(true);
    expect(isForbiddenPackage("@ai-sdk/openai")).toBe(true);
  });

  it.skipIf(!fs.existsSync(DB))("built database contains only verified tables", async () => {
    const { sqlite } = await import("@/lib/db/client");
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").pluck().all() as string[];
    expect(() => assertVerifiedTables(tables)).not.toThrow();
  });

  it("only lib/queries and lib/db import the database client", () => {
    const offenders = ["app", "components", "lib", "config"]
      .flatMap(sourceFiles)
      .filter((f) => !f.startsWith("lib/queries/") && !f.startsWith("lib/db/"))
      .filter((f) => /from ["'](@\/lib\/db\/client|better-sqlite3|drizzle-orm\/better-sqlite3)["']/.test(fs.readFileSync(path.join(ROOT, f), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("only lib/api.ts calls fetch", () => {
    const offenders = ["app", "components", "lib"]
      .flatMap(sourceFiles)
      .filter((f) => f !== "lib/api.ts")
      .filter((f) => /\bfetch\s*\(|XMLHttpRequest|new WebSocket|new EventSource/.test(fs.readFileSync(path.join(ROOT, f), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("confines each external service to its listed modules, and never to study data", () => {
    const supabase = HERMENEUTICS.externalServices.find((x) => x.name === "Supabase")!;
    const users = ["app", "components", "lib", "config"]
      .flatMap(sourceFiles)
      .filter((f) => /@supabase\/|@\/lib\/supabaseClient/.test(fs.readFileSync(path.join(ROOT, f), "utf8")));
    expect(users.filter((f) => !(supabase.modules as readonly string[]).includes(f))).toEqual([]);
    // The only table it touches is `subscribers`, and only by insert.
    const calls = (supabase.modules as readonly string[])
      .map((f) => fs.readFileSync(path.join(ROOT, f), "utf8"))
      .join("\n")
      .match(/\.from\([^)]*\)\.\w+/g);
    expect(calls).toEqual(['.from("subscribers").insert']);
  });

  it("lint rules block bypasses", async () => {
    const eslint = new ESLint({ cwd: ROOT });
    const probe = async (code: string, file: string) =>
      (await eslint.lintText(code, { filePath: path.join(ROOT, file) }))[0].messages.map((m) => m.ruleId);

    expect(await probe(`import OpenAI from "openai";\nexport const x = OpenAI;\n`, "components/x.tsx")).toContain("no-restricted-imports");
    expect(await probe(`import { sqlite } from "@/lib/db/client";\nexport const x = sqlite;\n`, "components/x.tsx")).toContain("no-restricted-imports");
    expect(await probe(`export const x = () => fetch("https://example.com");\n`, "components/x.tsx")).toContain("no-restricted-globals");
    expect(await probe(`export const x = () => window.fetch("/x");\n`, "app/x.tsx")).toContain("no-restricted-properties");
  }, 30_000);
});
