import { expect, test } from "@playwright/test";

test("draws the canon and filters arcs", async ({ page }) => {
  await page.goto("/iconograph");
  const shown = page.locator("dd").first();
  await expect(shown).toContainText("142,082");
  await page.getByRole("button", { name: "Between Testaments" }).click();
  await expect(page).toHaveURL(/tm=bridges/);
  await expect(shown).not.toContainText("28,416");
});

test("highlights a lemma's connections", async ({ page }) => {
  await page.goto("/iconograph?lemma=G0026");
  await expect(page.getByText("Both ends use")).toBeVisible();
  await expect(page.getByText(/[\d,]+ arcs/)).toBeVisible();
});

test("reader strip opens the focused Iconograph", async ({ page }) => {
  await page.goto("/read/isaiah/53");
  await page.getByRole("link", { name: "Open Iconograph →" }).click();
  await expect(page).toHaveURL(/\/iconograph\?focus=isaiah-53/);
  await expect(page.getByRole("link", { name: "Isaiah 53" })).toBeVisible();
});
