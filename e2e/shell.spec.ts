import { expect, test } from "@playwright/test";

// Phase 2 shell: landmarks, stepper states, route guards and focus (spec 5, UI-06 to UI-08, A11Y-01, A11Y-05).
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test("landmarks, title and stepper on a fresh start", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner")).toContainText("Policy Cards");
  await expect(page.getByRole("banner")).toContainText("New decomposition");
  const nav = page.getByRole("navigation", { name: "Workflow" });
  await expect(nav.locator("a[href]")).toHaveCount(1);
  await expect(nav.getByRole("link", { name: /Load policy/ })).toHaveAttribute("aria-current", "step");
  await expect(nav.locator('[aria-disabled="true"]')).toHaveCount(3);
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("Load a policy document");
  await expect(page).toHaveTitle("Load policy · Policy Cards");
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
});

test("guarded routes redirect to the earliest incomplete step with a notice (UI-08)", async ({ page }) => {
  for (const path of ["/decompose", "/review", "/publish"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Finish this step first.")).toBeVisible();
  }
});

test("locked steps explain why on focus (UI-07)", async ({ page }) => {
  await page.goto("/");
  await page.locator('nav [aria-disabled="true"]').first().focus();
  await expect(page.getByRole("tooltip")).toHaveText("Complete step 1 first");
});

test("shell screenshot", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "docs/screens/phase2-shell.png" });
});

test("a fresh visit does not autosave anything", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(800);
  await expect(page.getByRole("banner")).not.toContainText("Saving");
  expect(await page.evaluate(() => localStorage.getItem("pc:draft:v1"))).toBeNull();
});
