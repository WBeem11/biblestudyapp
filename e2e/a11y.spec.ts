import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = [
  "/",
  "/read/john/3",
  "/read/john/3?v=16",
  "/read/genesis/1?i=1&l=H1254A",
  "/read/john/3?i=1",
  "/read/john/3?th=1",
  "/iconograph",
  "/search?q=shepherd",
  "/about",
];

for (const path of PAGES) {
  for (const scheme of ["light", "dark"] as const) {
    test(`no serious accessibility violations: ${path} (${scheme}) @mobile`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(
        serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0]?.target.join(" ")}`),
      ).toEqual([]);
    });
  }
}
