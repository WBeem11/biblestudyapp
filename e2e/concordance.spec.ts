import { expect, test } from "@playwright/test";

test("interlinear word → parsing → concordance @mobile", async ({ page }) => {
  await page.goto("/read/genesis/1");
  await page.getByRole("button", { name: "Hebrew" }).click();
  await expect(page).toHaveURL(/i=1/);

  await page.getByRole("button", { name: /^בָּרָ֣א\s*,\s*ba\.Ra'\s*,\s*he created/ }).first().click();
  const pop = page.getByRole("dialog");
  await expect(pop).toContainText("to create");
  await expect(pop).toContainText("Verb · Qal · Perfect · 3rd person · Masculine · Singular");

  await pop.getByRole("button", { name: /See all \d+ occurrences/ }).click();
  await expect(page).toHaveURL(/l=H1254A/);
  const panel = page.getByRole("complementary", { name: /Concordance for/ });
  await expect(panel.getByRole("link", { name: /Genesis 1:1/ }).first()).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/l=/);
});

test("Greek parsing and TR-only words", async ({ page }) => {
  await page.goto("/read/john/3?i=1");
  await page.getByRole("button", { name: /^ἠγάπησεν/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Verb · Aorist · Active · Indicative · 3rd person · Singular");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /TR \(Textus Receptus only\)/ }).first()).toBeVisible();
});
