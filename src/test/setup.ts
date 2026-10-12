import "@testing-library/jest-dom/vitest";

// jsdom has no layout engine. Salt components observe size, so give them an inert observer;
// real layout is verified in Playwright (SALT-16).
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= NoopResizeObserver as unknown as typeof ResizeObserver;

// Same for scrolling: jsdom has no layout, so scrollIntoView is a no-op here.
Element.prototype.scrollIntoView ??= function scrollIntoView() {};
