import { expect, test } from "@playwright/test";

test("threads: every verse's connections, pinned in place without leaving the chapter", async ({ page }) => {
  await page.goto("/read/john/3");
  await page.getByRole("button", { name: "Threads", exact: true }).click();
  await expect(page).toHaveURL(/th=1/);

  const rail16 = page.getByRole("img", { name: /^John 3:16: \d+ cross-references across Scripture/ }).filter({ visible: true });
  await expect(rail16).toBeVisible();
  await expect(rail16).toHaveAccessibleName(/Strongest: .*Romans 5:8/);

  // Hover the Romans 5:8 tick, then click it to pin the passage under the verse.
  await rail16.scrollIntoViewIfNeeded();
  // An SVG <line> has zero width, which Playwright treats as hidden: read its position directly.
  const tickX = await rail16
    .locator('g[data-target="45005008-45005008"] line')
    .evaluate((el) => el.getBoundingClientRect().left);
  const svg = (await rail16.boundingBox())!;
  await page.mouse.move(tickX, svg.y + svg.height / 2);
  await expect(page.getByRole("tooltip").filter({ visible: true })).toContainText(/Romans \d+:\d+/);
  await page.mouse.click(tickX, svg.y + svg.height / 2);

  const pinned = page.locator("li.border-gilt").filter({ visible: true });
  await expect(pinned).toHaveCount(1);
  await expect(pinned).toContainText(/Romans/);
  await expect(page).toHaveURL(/\/read\/john\/3\?th=1$/); // still in John 3

  await pinned.getByRole("button", { name: /^Unpin/ }).click();
  await expect(pinned).toHaveCount(0);
});

test("threads: the count opens the full accessible list @mobile", async ({ page }) => {
  await page.goto("/read/john/3?th=1");
  await page.getByRole("button", { name: /^List \d+ cross-references for John 3:16$/ }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/v=16/);
  await expect(page.getByRole("complementary", { name: "Cross-references for John 3:16" })).toBeVisible();
});
