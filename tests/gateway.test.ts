import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { normalizeEmail, subscribe } from "@/lib/gateway";

/** A stand-in for the Supabase client that records inserts and returns a canned result. */
function fakeClient(result: { error: { code: string; message: string } | null } | Error) {
  const inserts: unknown[] = [];
  const client = {
    from(table: string) {
      return {
        insert: async (rows: unknown) => {
          inserts.push({ table, rows });
          if (result instanceof Error) throw result;
          return result;
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, inserts };
}

describe("email validation", () => {
  it("accepts ordinary addresses and normalizes them", () => {
    expect(normalizeEmail("  Student@Example.COM ")).toBe("student@example.com");
    expect(normalizeEmail("a.b+tag@sub.example.org")).toBe("a.b+tag@sub.example.org");
  });

  it("rejects malformed input", () => {
    for (const bad of ["", "   ", "student", "student@", "@example.com", "student@example", "a b@example.com", `${"a".repeat(250)}@x.io`]) {
      expect(normalizeEmail(bad)).toBeNull();
    }
  });
});

describe("gateway sign-up", () => {
  it("inserts a new subscriber into `subscribers`", async () => {
    const { client, inserts } = fakeClient({ error: null });
    expect(await subscribe("Student@Example.com", client)).toBe("subscribed");
    expect(inserts).toEqual([{ table: "subscribers", rows: [{ email: "student@example.com" }] }]);
  });

  it("lets a returning student in silently on a unique-constraint violation", async () => {
    const { client } = fakeClient({ error: { code: "23505", message: "duplicate key value violates unique constraint" } });
    expect(await subscribe("student@example.com", client)).toBe("returning");
  });

  it("does not insert invalid emails", async () => {
    const { client, inserts } = fakeClient({ error: null });
    expect(await subscribe("not-an-email", client)).toBe("invalid");
    expect(inserts).toEqual([]);
  });

  it("reports other failures instead of letting them in", async () => {
    expect(await subscribe("student@example.com", fakeClient({ error: { code: "42501", message: "RLS" } }).client)).toBe("error");
    expect(await subscribe("student@example.com", fakeClient(new Error("network down")).client)).toBe("error");
  });

  it("reports when Supabase isn't configured", async () => {
    expect(await subscribe("student@example.com", null)).toBe("unavailable");
  });
});
