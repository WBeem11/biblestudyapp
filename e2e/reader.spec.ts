import { expect, test } from "@playwright/test";

test("reads a chapter in parallel and opens cross-references @mobile", async ({ page }) => {
  await page.goto("/read/john/3");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("John 3");
  await expect(page.getByText("For God so loved the world").first()).toBeVisible();

  await page.getByRole("button", { name: /^Verse 16,/ }).click();
  await expect(page).toHaveURL(/v=16/);
  const sheet = page.getByRole("complementary", { name: "Cross-references for John 3:16" });
  await expect(sheet.getByRole("link").first()).toBeVisible();
  await expect(sheet.getByRole("link", { name: /Romans 5:8/ })).toBeVisible();
});

test("keyboard: j/k select verses, Escape clears, arrows change chapter", async ({ page }) => {
  await page.goto("/read/john/21");
  await page.keyboard.press("j");
  await page.keyboard.press("j");
  await expect(page).toHaveURL(/v=2/);
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/v=/);
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/read\/acts\/1$/);
});

test("translation toggles persist in the URL", async ({ page }) => {
  await page.goto("/read/psalms/23");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Psalm 23");
  await page.getByRole("button", { name: "BSB", exact: true }).click();
  await expect(page).toHaveURL(/t=KJV/);
  // Activity may keep a hidden copy of the previous view mounted; assert on the visible one.
  await expect(page.getByText("The Lord is my shepherd; I shall not want.").filter({ visible: true })).toHaveCount(1);
});

test("canonical redirects and real 404s", async ({ request }) => {
  const r = await request.get("/read/jn/3", { maxRedirects: 0 });
  expect(r.status()).toBe(308);
  expect(r.headers().location).toMatch(/\/read\/john\/3$/);
  expect((await request.get("/read/john/99")).status()).toBe(404);
});
