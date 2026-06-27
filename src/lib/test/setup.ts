import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// jsdom does not implement ResizeObserver. Provide a no-op shim so components
// that call `new ResizeObserver(...)` don't throw in unit tests. The actual
// resize-driven behavior (vpW/vpH updates, tick reflow) is not testable without
// real layout; it is covered by the pure heatmap-view.test.ts math tests.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// jsdom may not implement Blob.stream(). Provide polyfill for Compression Streams support.
if (typeof Blob !== 'undefined' && !Blob.prototype.stream) {
  Blob.prototype.stream = function () {
    const blob = this;
    return new ReadableStream({
      async start(controller) {
        const buffer = await blob.arrayBuffer();
        controller.enqueue(new Uint8Array(buffer));
        controller.close();
      }
    });
  };
}
