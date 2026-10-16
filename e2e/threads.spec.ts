import { expect, test } from "@playwright/test";

test("threads: read the chapter while following each verse's references", async ({ page }) => {
  await page.goto("/read/john/3");
  await page.getByRole("button", { name: "Threads", exact: true }).click();
  await expect(page).toHaveURL(/th=1/);
  await expect(page).toHaveURL(/v=1/);

  // The diagram is drawn beside the text.
  await expect(page.locator("canvas").filter({ visible: true })).toHaveCount(1);
  await expect(page.getByText("Genesis", { exact: true }).filter({ visible: true })).toBeVisible();

  // Select John 3:16: the panel lists where it points, in full, without leaving John 3.
  await page.getByRole("button", { name: /^Verse 16, \d+ cross-references$/ }).click();
  const panel = page.getByRole("complementary", { name: "Cross-references for John 3:16" });
  await expect(panel.getByRole("heading", { name: "John 3:16" })).toBeVisible();
  await expect(panel.getByRole("link", { name: /^Romans 5:8/ })).toBeVisible();
  await expect(panel).toContainText("God proves His love for us");
  await expect(page).toHaveURL(/\/read\/john\/3\?.*v=16/);

  // The panel's total matches the verse's count in the text column.
  const rowCount = (await page.getByRole("button", { name: /^Verse 16, / }).getAttribute("aria-label"))!.match(/(\d+) cross/)![1];
  await expect(panel.getByText(rowCount, { exact: true })).toBeVisible();

  // Step through verses from the panel; strongest-first ordering is available.
  await panel.getByRole("button", { name: "Next verse" }).click();
  await expect(page.getByRole("complementary", { name: "Cross-references for John 3:17" })).toBeVisible();
  await page.getByLabel("Order references").selectOption("strongest");
  await expect(page.getByRole("complementary", { name: /John 3:17/ }).getByText(/\d+ votes/).first()).toBeVisible();

  // Leave threads.
  await page.getByRole("button", { name: "Threads", exact: true }).click();
  await expect(page).not.toHaveURL(/th=1/);
});

test("threads on a phone: references open as a sheet @mobile", async ({ page }) => {
  await page.goto("/read/acts/1?th=1&v=8");
  const panel = page.getByRole("complementary", { name: "Cross-references for Acts 1:8" });
  await expect(panel.getByRole("heading", { name: "Acts 1:8" })).toBeVisible();
  await expect(panel.getByRole("img", { name: /Gospels \d+/ })).toBeAttached();
  await panel.getByRole("button", { name: "Close verse" }).click();
  await expect(panel).toHaveCount(0);
});
