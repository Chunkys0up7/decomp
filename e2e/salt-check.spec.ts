import { test, expect } from "@playwright/test";

// Phase 0 gate: build spec Appendix D (TEST-30) plus visual spec 11.2.
const DENSITY = process.env.APP_DENSITY ?? "low";

test("Salt is fully loaded", async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("requestfailed", (r) => failedRequests.push(r.url()));

  await page.goto("/__salt-check");
  await page.waitForSelector('[data-testid="app-root"]');
  await page.waitForSelector('[role="tooltip"]'); // tooltip is open on load (portal probe)

  const r = await page.evaluate(async () => {
    const openSans = await document.fonts.load('400 14px "Open Sans"');
    const ptMono = await document.fonts.load('400 13px "PT Mono"');
    await document.fonts.ready;

    const root = document.querySelector('[data-testid="app-root"]') as HTMLElement;
    const themed = root.closest(".salt-theme") as HTMLElement | null;
    const btn = document.querySelector('[data-testid="primary-button"]') as HTMLElement;
    const tip = document.querySelector('[role="tooltip"]') as HTMLElement;
    const panel = document.querySelector("[data-panel]") as HTMLElement;
    const btnStyle = getComputedStyle(btn);

    return {
      themeClassFound: Boolean(themed),
      densityClass: themed ? themed.className : "",
      mode: themed ? themed.getAttribute("data-mode") : null,
      spacingToken: getComputedStyle(root).getPropertyValue("--salt-spacing-100").trim(),
      componentCssInjected: [...document.head.querySelectorAll("style")].some((s) => (s.textContent ?? "").includes(".saltButton")),
      buttonBg: btnStyle.backgroundColor,
      buttonFont: btnStyle.fontFamily,
      buttonRadius: parseFloat(btnStyle.borderTopLeftRadius),
      openSansLoaded: openSans.length > 0 && openSans[0]!.status === "loaded",
      ptMonoLoaded: ptMono.length > 0 && ptMono[0]!.status === "loaded",
      tooltipSpacingToken: getComputedStyle(tip).getPropertyValue("--salt-spacing-100").trim(),
      canvas: getComputedStyle(root).backgroundColor,
      panelRadius: parseFloat(getComputedStyle(panel).borderTopLeftRadius),
      panelShadow: getComputedStyle(panel).boxShadow,
    };
  });

  expect(r.themeClassFound, "an ancestor of app-root has .salt-theme").toBe(true);
  expect(r.densityClass).toContain(`salt-density-${DENSITY}`);
  expect(r.mode).toBe("light");
  expect(r.spacingToken, "theme CSS tokens resolve").not.toBe("");
  expect(r.componentCssInjected, "component CSS injected into <head>").toBe(true);
  expect(r.buttonBg, "CTA uses the palette accent (visual spec 4.2)").toBe("rgb(31, 95, 209)");
  expect(r.buttonFont).toContain("Open Sans");
  expect(r.buttonRadius, "Salt controls are rounded (corner=rounded)").toBeGreaterThan(0);
  expect(r.openSansLoaded, "Open Sans loaded").toBe(true);
  expect(r.ptMonoLoaded, "PT Mono loaded").toBe(true);
  expect(r.tooltipSpacingToken, "tokens resolve inside the portal").not.toBe("");
  expect(r.canvas, "tinted canvas").toBe("rgb(243, 245, 248)");
  expect(r.panelRadius, "panels rounded").toBeGreaterThanOrEqual(12);
  expect(r.panelShadow, "panels elevated").not.toBe("none");
  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test("spacing map is measurable", async ({ page }) => {
  await page.goto("/__salt-check");
  await page.waitForSelector('[data-testid="spacing-probe"] [data-px]:not([data-px=""])');
  const map = await page.$$eval("[data-token]", (cells) =>
    cells.map((c) => [c.getAttribute("data-token"), Number(c.getAttribute("data-px"))] as const),
  );
  for (const [token, px] of map) expect(px, `${token} resolves to a width`).toBeGreaterThan(0);
  console.log(`SPACING_MAP ${DENSITY} ${JSON.stringify(Object.fromEntries(map))}`);
});
