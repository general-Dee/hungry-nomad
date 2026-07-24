import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom doesn't implement IntersectionObserver, but several components use
// framer-motion's `whileInView` (e.g. ProductCard), which needs one to even
// mount. A minimal stub is enough for tests — they don't rely on real
// viewport intersection, just on mounting without throwing.
if (typeof window !== 'undefined' && !('IntersectionObserver' in window)) {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = '';
    readonly thresholds: ReadonlyArray<number> = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  // @ts-expect-error - partial mock, sufficient for tests
  window.IntersectionObserver = MockIntersectionObserver;
  // some libs reference the global directly; no suppression needed here
  global.IntersectionObserver = MockIntersectionObserver;
}

// Unmount rendered React trees and clear localStorage between component
// tests so state (e.g. the cart, which persists to localStorage) never
// leaks from one test into the next. This setup file also runs for plain
// .test.ts unit tests under the 'node' environment, where `localStorage`
// doesn't exist, so guard the call.
afterEach(() => {
  cleanup();
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
});
