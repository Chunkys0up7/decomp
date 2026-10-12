import { expect, test, type Page } from "@playwright/test";

// Phase 3 Review screen on seeded state (`?demo=review`: F-001, R-002, C-006 approved).
const open = async (page: Page, query = "") => {
  await page.goto(`/review?demo=review${query}`);
  await page.waitForSelector('[aria-label="Card detail"] h2');
};
const cards = (page: Page) => page.getByRole("region", { name: "Cards" });
const source = (page: Page) => page.getByRole("region", { name: "Source document" });
const detail = (page: Page) => page.getByRole("region", { name: "Card detail" });
const row = (page: Page, id: string) => cards(page).locator(`button[data-card="${id}"]`);

test("seeded state: progress, default selection and landmarks", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Review cards");
  await expect(page.getByText("3 of 8 cards decided")).toBeVisible();
  await expect(page.getByRole("img", { name: "3 approved, 0 rejected, 5 pending" })).toBeVisible();
  await expect(row(page, "R-003")).toHaveAttribute("aria-current", "true");
  await expect(cards(page).locator("button[data-card]")).toHaveCount(8);
});

test("TEST-32 blocking guard", async ({ page }) => {
  await open(page);
  await row(page, "R-008").click();
  const approve = detail(page).getByRole("button", { name: "Approve card" });
  await expect(approve).toHaveAttribute("aria-disabled", "true");
  await expect(detail(page).getByText("Resolve the blocking issue to approve.").first()).toBeVisible();
  const cont = page.getByRole("button", { name: "Continue to publish" });
  await expect(cont).toHaveAttribute("aria-disabled", "true");
  await page.getByRole("button", { name: /Approve \d+ clean cards/ }).focus();
  await page.keyboard.press("Tab");
  await expect(cont).toBeFocused();
  await expect(page.getByRole("tooltip")).toHaveText("Decide every card first.");
});

test("TEST-33 lineage: linked passages and verbatim quotes", async ({ page }) => {
  await open(page);
  await row(page, "C-006").click();
  await expect(source(page).locator('[data-linked="true"]')).toHaveCount(1);
  await expect(source(page).locator('[data-passage="p6"]')).toHaveAttribute("data-linked", "true");

  await row(page, "P-007").click();
  await expect(source(page).locator('[data-linked="true"]')).toHaveCount(2);
  await expect(source(page).locator('[data-passage="p5"]')).toHaveAttribute("data-linked", "true");
  await expect(source(page).locator('[data-passage="p7"]')).toHaveAttribute("data-linked", "true");
  await expect(source(page).locator('[data-passage="p5"]').getByRole("button", { name: /R-005/ })).toBeVisible();

  await detail(page).getByRole("tab", { name: "Lineage" }).click();
  const quotes = await detail(page).locator("blockquote").allTextContents();
  const marks = await source(page).locator("mark").allTextContents();
  expect(quotes).toHaveLength(2);
  for (const m of marks) expect(quotes.some((q) => q.includes(m))).toBe(true);
});

test("decide, reopen and focus (UI-35), clean bulk approve, acknowledge uncovered", async ({ page }) => {
  await open(page);
  await row(page, "R-003").click();
  await detail(page).getByRole("button", { name: "Approve card" }).click();
  await expect(detail(page).getByRole("button", { name: "Reopen" })).toBeFocused();
  await expect(page.getByText("4 of 8 cards decided")).toBeVisible();
  await detail(page).getByRole("button", { name: "Reopen" }).click();
  await expect(detail(page).getByRole("button", { name: "Approve card" })).toBeFocused();

  const p8 = source(page).locator('[data-passage="p8"]');
  await expect(p8.getByText("No card generated")).toBeVisible();
  await p8.getByRole("button", { name: "Acknowledge" }).click();
  await expect(p8.getByRole("button", { name: "Acknowledged (undo)" })).toBeVisible();
});

test("keyboard moves selection in the card list (UI-33)", async ({ page }) => {
  await open(page);
  await row(page, "R-003").focus();
  await page.keyboard.press("ArrowDown");
  await expect(row(page, "C-004")).toHaveAttribute("aria-current", "true");
  await expect(row(page, "C-004")).toBeFocused();
  await page.keyboard.press("End");
  await expect(row(page, "R-008")).toHaveAttribute("aria-current", "true");
  await page.keyboard.press("Home");
  await expect(row(page, "F-001")).toHaveAttribute("aria-current", "true");
});

test("URL state (UI-10, TEST-36)", async ({ page }) => {
  await open(page, "&card=P-007&tab=lineage&filter=attention");
  await expect(row(page, "P-007")).toHaveAttribute("aria-current", "true");
  await expect(detail(page).getByRole("tab", { name: "Lineage" })).toHaveAttribute("aria-selected", "true");
  await expect(cards(page).locator("button[data-card]")).toHaveCount(5); // R-003, C-004, R-005, P-007, R-008
  await row(page, "R-005").click();
  await expect(page).toHaveURL(/card=R-005/);

  await open(page, "&card=NOPE&tab=bogus&filter=weird");
  await expect(row(page, "R-003")).toHaveAttribute("aria-current", "true");
  await expect(detail(page).getByRole("tab", { name: "Card" })).toHaveAttribute("aria-selected", "true");
});

test("review screenshots", async ({ page }) => {
  await open(page, "&card=P-007");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "docs/screens/phase3-review.png" });
  await row(page, "R-008").click();
  await page.screenshot({ path: "docs/screens/phase3-review-blocked.png" });
});
