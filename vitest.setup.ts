import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement ResizeObserver; framer-motion/recharts probe
// for it defensively but a missing global still throws in some code
// paths. Not exercised by the login-screen tests specifically, but cheap
// to stub so mounting the full page.tsx component never trips on it.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
