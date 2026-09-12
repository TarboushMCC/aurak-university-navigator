import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement ResizeObserver; CampusMap uses it to track its
// container size. A no-op stub is enough for component tests.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
