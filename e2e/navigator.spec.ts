import { expect, test } from "@playwright/test";

test("⌘K goes to a reference", async ({ page }) => {
  await page.goto("/read/john/1");
  await page.keyboard.press("ControlOrMeta+k");
  const input = page.getByRole("combobox");
  await input.fill("rom 8:28");
  await expect(page.getByRole("option", { name: "Go to Romans 8:28" })).toBeVisible();
  await input.press("Enter");
  await expect(page).toHaveURL(/\/read\/romans\/8\?v=28/);
});

test("⌘K searches words and links to full results", async ({ page }) => {
  await page.goto("/read/john/1");
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByRole("combobox").fill("loving devotion");
  const all = page.getByRole("option", { name: /See all [\d,]+ verses/ });
  await expect(all).toBeVisible();
  await all.click();
  await expect(page).toHaveURL(/\/search\?q=loving/);
  await expect(page.getByText(/\d+ verses in the BSB/)).toBeVisible();
  await expect(page.locator("mark").first()).toBeVisible();
});

test("search page treats operators as plain text @mobile", async ({ page }) => {
  await page.goto("/search?q=" + encodeURIComponent('love" OR verse_id:1'));
  await expect(page.getByText(/verses? in the BSB/)).toBeVisible();
});
