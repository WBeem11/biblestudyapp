import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = [
  "/",
  "/read/john/3",
  "/read/john/3?v=16",
  "/read/genesis/1?i=1&l=H1254A",
  "/read/john/3?i=1",
  "/read/john/3?th=1&v=16",
  "/iconograph",
  "/search?q=shepherd",
  "/about",
];

// The app is dark-only, so one pass per page covers every theme.
for (const path of PAGES) {
  test(`no serious accessibility violations: ${path} @mobile`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(
      serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0]?.target.join(" ")}`),
    ).toEqual([]);
  });
}
