import fs from "node:fs";
import { expect, test } from "@playwright/test";

// Sign-up only runs when the build has Supabase configured (.env.local locally, Vercel env in prod).
const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL || fs.existsSync(".env.local");

test("gateway validates the email before sending anything @mobile", async ({ page }) => {
  let inserts = 0;
  await page.route("**/rest/v1/subscribers*", (route) => {
    inserts++;
    return route.fulfill({ status: 201, body: "" });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Bible Study" })).toBeVisible();
  await page.getByLabel("EMAIL").fill("not-an-email");
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("Please enter a valid email address.");
  expect(inserts).toBe(0);
});

for (const [label, status, body] of [
  ["new subscriber", 201, ""],
  ["returning student (unique violation)", 409, JSON.stringify({ code: "23505", message: "duplicate key value violates unique constraint" })],
] as const) {
  test(`gateway lets a ${label} in and remembers them`, async ({ page }) => {
    test.skip(!configured, "Supabase isn't configured for this build");
    // Intercepted: the live `subscribers` table is never written by tests.
    let sent: unknown = null;
    await page.route("**/rest/v1/subscribers*", (route) => {
      sent = route.request().postDataJSON();
      return route.fulfill({ status, contentType: "application/json", body });
    });
    await page.goto("/");
    await page.getByLabel("EMAIL").fill("  Student@Example.com ");
    await page.getByRole("button", { name: "Enter" }).click();
    await expect(page.getByRole("link", { name: /Iconograph/ }).filter({ visible: true }).last()).toBeVisible();
    expect(sent).toEqual([{ email: "student@example.com" }]);
    expect(await page.evaluate(() => localStorage.getItem("biblestudy_entered"))).toBe("true");

    await page.reload();
    await expect(page.getByLabel("EMAIL")).toHaveCount(0); // straight to the workspace
  });
}

test("gateway stays put when sign-up fails", async ({ page }) => {
  test.skip(!configured, "Supabase isn't configured for this build");
  await page.route("**/rest/v1/subscribers*", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ code: "42501", message: "denied" }) }),
  );
  await page.goto("/");
  await page.getByLabel("EMAIL").fill("student@example.com");
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("couldn’t save your email");
  expect(await page.evaluate(() => localStorage.getItem("biblestudy_entered"))).toBeNull();
});
