import { expect, test, type Page } from "@playwright/test";

// Phase 5 Load screen (spec 9.1, TEST-17, TEST-23, TEST-34, part of TEST-35).
const fresh = async (page: Page) => {
  await page.goto("/?delay=0");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/?delay=0");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Load a policy document");
};
const upload = (page: Page, name: string) =>
  page.locator('input[type="file"]').first().setInputFiles({ name, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
const decompose = (page: Page) => page.getByRole("button", { name: "Decompose policy" });
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });

async function tooltipFor(page: Page) {
  await page.getByRole("button", { name: "Save draft" }).focus();
  await page.keyboard.press("Tab");
  await expect(decompose(page)).toBeFocused();
  return page.getByRole("tooltip");
}

test("empty state: drop zone, disabled fields, Decompose explains why", async ({ page }) => {
  await fresh(page);
  await expect(page.getByText("Drop a policy document here")).toBeVisible();
  await expect(field(page, "Policy ID")).toBeDisabled();
  await expect(decompose(page)).toHaveAttribute("aria-disabled", "true");
  await expect(await tooltipFor(page)).toHaveText("Load a policy document first.");
});

test("load, validate, configure and decompose (TEST-23, TEST-17)", async ({ page }) => {
  await fresh(page);
  await upload(page, "underwriting-policy.pdf");
  await expect(page.getByText("underwriting-policy.pdf")).toBeVisible();
  await expect(page.getByText("5 sections · 9 passages · 14 pages")).toBeVisible();
  await expect(field(page, "Policy ID")).toHaveValue("POL-HL-0142");
  await expect(page.getByRole("banner")).toContainText("POL-HL-0142 v3.1");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "docs/screens/phase5-load.png", fullPage: true });

  await field(page, "Owner").fill("   ");
  await field(page, "Owner").blur();
  await expect(page.getByText("Enter an owner.")).toBeVisible();
  await expect(await tooltipFor(page)).toHaveText("Fix the highlighted policy details.");
  await field(page, "Owner").fill("Underwriting Policy");
  await field(page, "Owner").blur();
  await expect(page.getByText("Enter an owner.")).toHaveCount(0);

  await field(page, "Policy ID").fill(" abc123 ");
  await field(page, "Policy ID").blur();
  await expect(field(page, "Policy ID")).toHaveValue("ABC123");
  await expect(page.getByText("Non-standard policy ID. Card URIs will use the fallback form.")).toBeVisible();
  await field(page, "Policy ID").fill("POL-HL-0142");

  await expect(page.getByText("4 card types · one obligation per card · 4 checks on")).toBeVisible();
  for (const t of ["Fact", "Rule", "Calculation", "Procedure"]) await page.getByRole("button", { name: new RegExp(`^${t}`) }).click();
  await expect(page.getByText("0 card types")).toBeVisible();
  await expect(await tooltipFor(page)).toHaveText("Select at least one card type.");
  for (const t of ["Fact", "Rule", "Calculation", "Procedure"]) await page.getByRole("button", { name: new RegExp(`^${t}`) }).click();
  await expect(page.getByRole("button", { name: /^Rule/ })).toHaveAttribute("aria-pressed", "true");

  await decompose(page).click();
  await expect(page).toHaveURL(/\/decompose/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Decomposition complete");
});

test("ingest failure shows the adapter message (TEST-34)", async ({ page }) => {
  await fresh(page);
  await upload(page, "fail.pdf");
  await expect(page.getByText("This file could not be read.")).toBeVisible();
  await expect(page.getByText("Drop a policy document here")).toBeVisible();
});

test("decomposition failure offers Try again (TEST-34)", async ({ page }) => {
  await fresh(page);
  await upload(page, "policy.pdf");
  await field(page, "Policy ID").fill("POL-FAIL-0001");
  await field(page, "Policy ID").blur();
  await decompose(page).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Decomposition failed");
  await expect(page.getByRole("button", { name: "Try again" }).first()).toBeVisible();
  await expect(page.locator('li[data-status="failed"]')).toHaveCount(1);
});

test("re-running after a completed run asks first (UI-09)", async ({ page }) => {
  await fresh(page);
  await upload(page, "policy.pdf");
  await decompose(page).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Decomposition complete");
  await page.getByRole("navigation", { name: "Workflow" }).getByRole("link", { name: /Load policy/ }).click();
  await decompose(page).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Re-running replaces the current cards and decisions.");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/(\?.*)?$/);
});

test("draft restores after reload, and Start over clears it (PER-03, PER-05)", async ({ page }) => {
  await fresh(page);
  await upload(page, "policy.pdf");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("banner")).toContainText("Draft saved");
  await page.reload();
  await expect(page.getByText(/Draft restored/)).toBeVisible();
  await expect(field(page, "Policy ID")).toHaveValue("POL-HL-0142");

  await page.getByRole("button", { name: "Start over" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Start over" }).click();
  await expect(page.getByText("Drop a policy document here")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("pc:draft:v1"))).toBeNull();
});
