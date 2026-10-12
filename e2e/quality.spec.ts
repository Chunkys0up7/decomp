import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// TEST-40 (axe on every screen and state) and visual spec 10 guardrails, at desktop and phone widths.

async function axe(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const summary = serious.map((v) => `${v.id}: ${v.help} -> ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(summary, `axe serious/critical on ${label}`).toEqual([]);
}

/**
 * Visual spec 10. "Padding" is the panel's content inset: its own padding, or its first child's
 * when the panel hosts a full-bleed header (review panes, document panel, artifacts table).
 */
async function guardrails(page: Page, label: string, { phone = false } = {}) {
  const r = await page.evaluate(() => {
    const cs = (e: Element) => getComputedStyle(e);
    const visible = (e: Element) => (e as HTMLElement).offsetParent !== null;
    const panels = [...document.querySelectorAll<HTMLElement>("[data-panel]")].filter(visible);
    const inset = (p: HTMLElement) => {
      const own = parseFloat(cs(p).paddingLeft);
      const first = p.firstElementChild;
      return own > 0 || !first ? own : parseFloat(cs(first).paddingLeft);
    };
    return {
      canvas: cs(document.querySelector('[data-testid="app-root"]')!).backgroundColor,
      panels: panels.map((p) => ({
        name: p.getAttribute("aria-label") ?? p.getAttribute("aria-labelledby") ?? p.className,
        radius: parseFloat(cs(p).borderTopLeftRadius),
        inset: inset(p),
        shadow: cs(p).boxShadow,
      })),
      cta: [...document.querySelectorAll(".saltButton-solid.saltButton-accented")].filter(visible).length,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  expect(r.canvas, `${label}: tinted canvas`).toBe("rgb(243, 245, 248)");
  expect(r.panels.length, `${label}: has panels`).toBeGreaterThan(0);
  for (const p of r.panels) {
    expect(p.radius, `${label}: ${p.name} radius`).toBeGreaterThanOrEqual(12);
    expect(p.inset, `${label}: ${p.name} inset`).toBeGreaterThanOrEqual(phone ? 16 : 20);
    expect(p.shadow, `${label}: ${p.name} shadow`).not.toBe("none");
  }
  expect(r.cta, `${label}: at most one filled accent button`).toBeLessThanOrEqual(1);
  expect(r.overflowX, `${label}: no horizontal page scroll`).toBe(false);
}

const check = async (page: Page, label: string) => {
  await page.evaluate(() => document.fonts.ready);
  await axe(page, label);
  await guardrails(page, label);
};

const upload = (page: Page, name = "policy.pdf") =>
  page.locator('input[type="file"]').first().setInputFiles({ name, mimeType: "application/pdf", buffer: Buffer.from("%PDF") });

test.beforeEach(async ({ page }) => {
  await page.goto("/?delay=0");
  await page.evaluate(() => localStorage.clear());
});

test("screen 1: empty, ready, validation errors", async ({ page }) => {
  await page.goto("/?delay=0");
  await check(page, "load empty");
  await upload(page);
  await expect(page.getByText("Parsed")).toBeVisible();
  await check(page, "load ready");
  await page.getByLabel("Owner", { exact: true }).fill("");
  await page.getByLabel("Version", { exact: true }).fill("v3");
  await page.getByLabel("Version", { exact: true }).blur();
  await page.getByLabel("Owner", { exact: true }).blur();
  await expect(page.getByText("Enter an owner.")).toBeVisible();
  await check(page, "load validation errors");
});

test("screen 2: running, completed, failed", async ({ page }) => {
  await page.goto("/decompose?demo=loaded");
  await page.getByRole("button", { name: "Decompose policy" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Decomposing policy");
  await check(page, "decompose running");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Decomposition complete", { timeout: 10_000 });
  await check(page, "decompose completed");

  await page.goto("/?delay=0");
  await page.getByLabel("Policy ID", { exact: true }).fill("POL-FAIL-0001");
  await page.getByLabel("Policy ID", { exact: true }).blur();
  await page.getByRole("button", { name: "Decompose policy" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Run again" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Decomposition failed");
  await check(page, "decompose failed");
});

test("screen 3: each tab, blocked card, decided card", async ({ page }) => {
  await page.goto("/review?demo=review");
  const detail = page.getByRole("region", { name: "Card detail" });
  await expect(detail.locator("h2")).toBeVisible();
  for (const tab of ["Card", "Lineage", "Artifact"]) {
    await detail.getByRole("tab", { name: tab }).click();
    await check(page, `review ${tab} tab`);
  }
  await page.locator('button[data-card="R-008"]').click();
  await check(page, "review blocked card");
  await page.locator('button[data-card="F-001"]').click();
  await expect(detail.getByRole("button", { name: "Reopen" })).toBeVisible();
  await check(page, "review decided card");
});

test("screen 4: gates pass and confirm dialog", async ({ page }) => {
  await page.goto("/review?demo=review&delay=0");
  await page.locator('[data-passage="p8"]').getByRole("button", { name: "Acknowledge" }).click();
  await page.locator('button[data-card="R-008"]').click();
  await page.getByRole("region", { name: "Card detail" }).getByRole("button", { name: "Reject" }).click();
  for (const id of ["R-003", "C-004", "R-005", "P-007"]) {
    await page.locator(`button[data-card="${id}"]`).click();
    await page.getByRole("region", { name: "Card detail" }).getByRole("button", { name: "Approve card" }).click();
  }
  await page.getByRole("button", { name: "Continue to publish" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Publish approved cards");
  await check(page, "publish gates pass");
  await page.getByRole("button", { name: "Publish 7 cards" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // Measure the settled dialog, not a frame of its fade-in.
  await dialog.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
  await page.waitForTimeout(300);
  await axe(page, "publish dialog open");
});

test("phone width: every screen reflows without horizontal scroll (A11Y-10)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/?demo=loaded", "/decompose?demo=review", "/review?demo=review"]) {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    await guardrails(page, `phone ${path}`, { phone: true });
  }
});
