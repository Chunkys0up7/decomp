/**
 * Brings `el` into view inside its scrolling `container` only (UI-34). Unlike scrollIntoView, it
 * never scrolls the page itself, which matters when the panes stack on narrow screens.
 * `align: "start"` puts the element just below the sticky header, a position that does not depend
 * on the container's height (which can still be settling when selection changes).
 */
export function scrollWithin(container: HTMLElement | null, el: HTMLElement | null | undefined, align: "nearest" | "start" = "nearest"): void {
  if (!container || !el) return;
  const c = container.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const sticky = container.querySelector<HTMLElement>(":scope > [data-sticky]")?.offsetHeight ?? 0;
  const top = c.top + sticky;
  if (r.top >= top && r.bottom <= c.bottom) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const delta = align === "start" || r.top < top ? r.top - top : r.bottom - c.bottom;
  container.scrollBy({ top: delta, behavior: reduce ? "auto" : "smooth" });
}
