import { expect, test, type Page } from "@playwright/test";
import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import schema from "../src/domain/schema/policy-card.schema.json" with { type: "json" };

// TEST-31: the whole happy path with the mock adapters, ending in a validated export.
const cards = (page: Page) => page.getByRole("region", { name: "Cards" });
const detail = (page: Page) => page.getByRole("region", { name: "Card detail" });
const select = (page: Page, id: string) => cards(page).locator(`button[data-card="${id}"]`).click();

test("TEST-31 load, decompose, review, publish and export", async ({ page }) => {
  await page.goto("/?delay=0");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/?delay=0");

  // Screen 1
  await page.locator('input[type="file"]').first().setInputFiles({ name: "policy.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF") });
  await expect(page.getByLabel("Policy ID", { exact: true })).toHaveValue("POL-HL-0142");
  await page.getByRole("button", { name: "Decompose policy" }).click();

  // Screen 2
  await expect(page.getByTestId("tile-cards")).toContainText("8");
  await expect(page.getByTestId("tile-covered")).toContainText("8 of 9");
  await expect(page.getByTestId("tile-issues")).toContainText("1 blocking, 3 warnings, 1 note");
  await page.getByRole("button", { name: "Review 8 cards" }).click();

  // Screen 3
  await expect(cards(page).locator('button[data-card="R-003"]')).toHaveAttribute("aria-current", "true");
  await page.getByRole("button", { name: "Approve 3 clean cards" }).click();
  await expect(page.getByText("3 of 8 cards decided")).toBeVisible();

  await select(page, "R-008");
  await detail(page).getByRole("button", { name: "Mark resolved" }).click();
  await detail(page).getByRole("button", { name: "Reject" }).click();

  await page.getByRole("region", { name: "Source document" }).locator('[data-passage="p8"]').getByRole("button", { name: "Acknowledge" }).click();

  for (const id of ["R-003", "C-004", "R-005", "P-007"]) {
    await select(page, id);
    await detail(page).getByRole("button", { name: "Approve card" }).click();
  }
  await expect(page.getByText("8 of 8 cards decided")).toBeVisible();
  const cont = page.getByRole("button", { name: "Continue to publish" });
  await expect(cont).not.toHaveAttribute("aria-disabled", "true");
  await cont.click();

  // Screen 4
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Publish approved cards");
  await expect(page.getByText("All 8 cards have a decision")).toBeVisible();
  await expect(page.getByText("Uncovered passages acknowledged")).toBeVisible();
  await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(8);
  await expect(page.getByText("Not published")).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "docs/screens/phase6-publish.png", fullPage: true });

  await page.getByRole("button", { name: "Publish 7 cards" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("This creates 7 artifacts for POL-HL-0142 v3.1. Rejected cards are not published.");
  await dialog.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("main").getByText("Published 7 cards as package POL-HL-0142@3.1. 1 rejected.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Published" })).toBeDisabled();
  await expect(page.getByRole("navigation", { name: "Workflow" }).getByRole("link", { name: /Publish/ })).toContainText("complete");

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export JSON" }).click()]);
  expect(download.suggestedFilename()).toBe("POL-HL-0142@3.1.policy-cards.json");
  const pkg = JSON.parse(readFileSync(await download.path(), "utf8"));
  expect(pkg.artifacts).toHaveLength(7);
  expect(pkg.manifest.rejected).toEqual([{ card_id: "PC-HL0142-R008", title: "Reserve adequacy" }]);
  expect(pkg.manifest.uncovered_passages).toEqual([{ passage: "4.2", acknowledged: true }]);
  const validate = new Ajv2020({ allErrors: true }).compile(schema);
  for (const a of pkg.artifacts) {
    expect(validate(a), JSON.stringify(validate.errors)).toBe(true);
    expect(a.content_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(pkg.manifest.cards.find((c: { card_id: string }) => c.card_id === a.card_id).content_hash).toBe(a.content_hash);
  }
});
