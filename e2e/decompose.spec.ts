import { expect, test, type Page } from "@playwright/test";

// Phase 4 Decompose screen on `?demo=loaded` (document and metadata ready, no run).
const open = async (page: Page, query = "") => {
  await page.goto(`/decompose?demo=loaded${query}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ready to decompose");
};
const start = (page: Page) => page.getByRole("button", { name: "Decompose policy" }).click();

test("a run goes from running to completed with the spec's counts (TEST-31 screen 2)", async ({ page }) => {
  await open(page);
  await start(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Decomposing policy");
  await expect(page.getByRole("button", { name: "Cancel run" })).toBeVisible();
  await page.screenshot({ path: "docs/screens/phase4-decompose-running.png" });

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Decomposition complete", { timeout: 10_000 });
  await expect(page.getByText("8 cards were extracted from 9 passages. 1 passage produced no card and 5 issues need a look before cards can be approved.")).toBeVisible();
  await expect(page.getByTestId("tile-cards")).toContainText("8");
  await expect(page.getByTestId("tile-covered")).toContainText("8 of 9");
  await expect(page.getByTestId("tile-covered")).toContainText("4.2 has no card");
  await expect(page.getByTestId("tile-issues")).toContainText("5");
  await expect(page.getByTestId("tile-issues")).toContainText("1 blocking, 3 warnings, 1 note");
  await expect(page.locator("li[data-uncovered]")).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Issues found" }).getByRole("link")).toHaveCount(5);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "docs/screens/phase4-decompose-complete.png", fullPage: true });

  await page.getByRole("button", { name: "Review 8 cards" }).click();
  await expect(page).toHaveURL(/\/review/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Review cards");
});

test("cancel stops the run and nothing is kept", async ({ page }) => {
  await open(page);
  await start(page);
  await page.getByRole("button", { name: "Cancel run" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Run cancelled");
  await expect(page.getByText("Run cancelled.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Decompose again" })).toBeVisible();
});

test("leaving the screen does not cancel the run (ADP-01)", async ({ page }) => {
  await open(page);
  await start(page);
  await page.getByRole("navigation", { name: "Workflow" }).getByRole("link", { name: /Load policy/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.waitForTimeout(2500);
  await page.getByRole("navigation", { name: "Workflow" }).getByRole("link", { name: /Decompose/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Decomposition complete");
});

test("coverage links go to the right card in review", async ({ page }) => {
  await open(page, "&delay=0");
  await start(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Decomposition complete");
  await page.getByRole("link", { name: "C-006" }).click();
  await expect(page.locator('button[data-card="C-006"]')).toHaveAttribute("aria-current", "true");
});
