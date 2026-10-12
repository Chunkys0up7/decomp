import { expect, test, type Page } from "@playwright/test";

// Phase 7: TEST-35 persistence, TEST-37 keyboard only, TEST-41 visual baselines, TEST-42 contrast.

const fresh = async (page: Page) => {
  await page.goto("/?delay=0");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/?delay=0");
};
const upload = (page: Page) =>
  page.locator('input[type="file"]').first().setInputFiles({ name: "policy.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF") });
const press = async (page: Page, target: ReturnType<Page["locator"]>, key = "Enter") => {
  await target.focus();
  await page.keyboard.press(key);
};

test("TEST-35 reload on review restores decisions and selection; draft banner on load", async ({ page }) => {
  await fresh(page);
  await upload(page);
  await page.getByRole("button", { name: "Decompose policy" }).click();
  await page.getByRole("button", { name: "Review 8 cards" }).click();
  await page.locator('button[data-card="F-001"]').click();
  await page.getByRole("region", { name: "Card detail" }).getByRole("button", { name: "Approve card" }).click();
  await page.locator('button[data-card="R-002"]').click();
  await page.getByRole("region", { name: "Card detail" }).getByRole("button", { name: "Approve card" }).click();
  await page.locator('button[data-card="C-004"]').click();
  await expect(page.getByRole("banner")).toContainText("Decisions autosaved");

  await page.goto("/review");
  await expect(page.getByText("2 of 8 cards decided")).toBeVisible();
  await expect(page.locator('button[data-card="C-004"]')).toHaveAttribute("aria-current", "true");

  await page.goto("/");
  await expect(page.getByText(/Draft restored/)).toBeVisible();
});

test("TEST-37 the happy path with the keyboard only", async ({ page }) => {
  await fresh(page);
  const chooser = page.waitForEvent("filechooser");
  await press(page, page.getByRole("button", { name: "Browse files" }));
  await (await chooser).setFiles({ name: "policy.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF") });
  await press(page, page.getByRole("button", { name: "Decompose policy" }));
  await press(page, page.getByRole("button", { name: "Review 8 cards" }));

  await press(page, page.getByRole("button", { name: "Approve 3 clean cards" }));
  const detail = page.getByRole("region", { name: "Card detail" });

  // R-003 is selected; approve it, then walk the list with arrow keys from the selected row.
  const selected = page.locator('button[data-card][aria-current="true"]');
  const arrowTo = async (key: string, id: string) => {
    await selected.focus();
    await page.keyboard.press(key);
    await expect(page.locator(`button[data-card="${id}"]`)).toHaveAttribute("aria-current", "true");
  };
  await press(page, detail.getByRole("button", { name: "Approve card" }));
  await arrowTo("ArrowDown", "C-004");
  await press(page, detail.getByRole("button", { name: "Approve card" }));
  await arrowTo("ArrowDown", "R-005");
  await press(page, detail.getByRole("button", { name: "Approve card" }));
  await arrowTo("ArrowDown", "C-006");
  await arrowTo("ArrowDown", "P-007");
  await press(page, detail.getByRole("button", { name: "Approve card" }));
  await arrowTo("End", "R-008");
  await press(page, detail.getByRole("button", { name: "Mark resolved" }));
  await press(page, detail.getByRole("button", { name: "Reject" }));
  await press(page, page.locator('[data-passage="p8"]').getByRole("button", { name: "Acknowledge" }));

  await press(page, page.getByRole("button", { name: "Continue to publish" }));
  await press(page, page.getByRole("button", { name: "Publish 7 cards" }));
  await press(page, page.getByRole("dialog").getByRole("button", { name: "Publish" }));
  await expect(page.getByRole("main").getByText("Published 7 cards as package POL-HL-0142@3.1. 1 rejected.")).toBeVisible();
  await page.keyboard.press("Escape");
});

test("TEST-42 badge text meets 4.5:1 on its tint", async ({ page }) => {
  await page.goto("/review?demo=review&card=R-008");
  await page.locator('[data-passage="p8"]').getByRole("button", { name: "Acknowledge" }).click();
  await page.locator('button[data-card="R-008"]').click();
  await page.getByRole("region", { name: "Card detail" }).getByRole("button", { name: "Reject" }).click();
  await page.locator('button[data-card="R-005"]').click(); // its issues panel shows a Note badge
  const ratios = await page.evaluate(() => {
    const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
    };
    const contrast = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x! + 0.05) / (y! + 0.05); };
    return [...document.querySelectorAll<HTMLElement>("[data-severity], [data-decision]")].map((el) => {
      const s = getComputedStyle(el);
      return { kind: el.dataset.severity ?? el.dataset.decision, ratio: contrast(parse(s.color), parse(s.backgroundColor)) };
    });
  });
  const kinds = new Set(ratios.map((r) => r.kind));
  for (const k of ["error", "warning", "info", "approved", "rejected", "pending"]) expect(kinds, `badge kind ${k} rendered`).toContain(k);
  for (const r of ratios) expect(r.ratio, `${r.kind} contrast`).toBeGreaterThanOrEqual(4.5);
});

test.describe("TEST-41 visual baselines", () => {
  test.use({ reducedMotion: "reduce" });
  const shots: [string, string][] = [
    ["load", "/?demo=loaded"],
    ["decompose", "/decompose?demo=review"],
    ["review", "/review?demo=review&card=P-007"],
  ];
  for (const [width, height] of [[1440, 900], [390, 844]] as const) {
    for (const [name, path] of shots) {
      test(`${name} at ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(300);
        await expect(page).toHaveScreenshot(`${name}-${width}.png`, {
          fullPage: false,
          animations: "disabled",
          caret: "hide",
          mask: [page.locator('[aria-live]').first()],
          maxDiffPixelRatio: 0.002,
        });
      });
    }
  }
});
