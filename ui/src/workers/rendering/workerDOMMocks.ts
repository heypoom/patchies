/**
 * DOM mocks for Web Worker environment.
 * Required for libraries like textmode.js that expect browser APIs.
 */

// Track created canvases for potential cleanup
const createdCanvases: OffscreenCanvas[] = [];

// Mock FontFace storage (Web Workers have FontFace but not document.fonts)
const mockFonts = new Set<FontFace>();

type MockImageCanvas = OffscreenCanvas & {
  crossOrigin?: string;
  naturalHeight: number;
  naturalWidth: number;
  onerror?: (error: unknown) => void;
  onload?: (event: Event) => void;
  src: string;
};

function createMockImage(): MockImageCanvas {
  const canvas = new OffscreenCanvas(1, 1) as MockImageCanvas;

  Object.defineProperties(canvas, {
    naturalWidth: {
      get: () => canvas.width
    },
    naturalHeight: {
      get: () => canvas.height
    },
    src: {
      set: (source: string) => {
        void (async () => {
          try {
            const response = await fetch(source);
            const bitmap = await createImageBitmap(await response.blob());
            const context = canvas.getContext('2d');

            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            context?.drawImage(bitmap, 0, 0);
            bitmap.close();
            canvas.onload?.(new Event('load'));
          } catch (error) {
            canvas.onerror?.(error);
          }
        })();
      }
    }
  });

  return canvas;
}

function createMockElement(tagName: string): unknown {
  const tag = tagName.toLowerCase();

  if (tag === 'canvas') {
    const canvas = new OffscreenCanvas(800, 600);
    createdCanvases.push(canvas);

    // Add style property that textmode.js expects
    // @ts-expect-error -- mock for DOM compatibility
    canvas.style = {
      imageRendering: 'pixelated',
      top: '0px',
      left: '0px',
      position: 'absolute',
      width: '800px',
      height: '600px'
    };

    // @ts-expect-error -- mock for DOM compatibility
    canvas.className = '';

    return canvas;
  }

  if (tag === 'video') {
    // Return a mock video element that won't actually play
    return {
      crossOrigin: 'anonymous',
      loop: true,
      muted: true,
      playsInline: true,
      src: '',
      play: () => Promise.resolve(),
      pause: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      style: {}
    };
  }

  // Generic mock element
  return {
    tagName: tagName.toUpperCase(),
    style: {},
    className: '',
    appendChild: () => {},
    removeChild: () => {},
    addEventListener: () => {},
    removeEventListener: () => {}
  };
}

// Mock document object
const mockDocument = {
  createElement: createMockElement,

  body: {
    appendChild: () => {},
    removeChild: () => {},
    style: {
      backgroundColor: 'rgb(0, 0, 0)'
    }
  },

  documentElement: {
    style: {
      backgroundColor: 'rgb(0, 0, 0)'
    }
  },

  fonts: {
    add: (font: FontFace) => {
      mockFonts.add(font);
    },
    delete: (font: FontFace) => {
      mockFonts.delete(font);
    },
    has: (font: FontFace) => mockFonts.has(font),
    [Symbol.iterator]: () => mockFonts.values()
  }
};

// Mock window additions (Web Workers already have setTimeout, etc.)
const mockWindow = {
  getComputedStyle: () => ({
    backgroundColor: 'rgb(0, 0, 0)',
    width: '800px',
    height: '600px'
  }),
  scrollX: 0,
  scrollY: 0,
  addEventListener: self.addEventListener.bind(self),
  removeEventListener: self.removeEventListener.bind(self),
  setTimeout: self.setTimeout.bind(self),
  clearTimeout: self.clearTimeout.bind(self),
  setInterval: self.setInterval.bind(self),
  clearInterval: self.clearInterval.bind(self)
};

let isSetup = false;

/**
 * Sets up DOM mocks in the Web Worker global scope.
 * Call this before importing libraries that need DOM APIs.
 */
export function setupWorkerDOMMocks(): void {
  if (isSetup) return;

  // @ts-expect-error -- injecting document into worker global
  self.document = mockDocument;

  // Define `window` as a global variable (libraries access it directly, not through self)
  // @ts-expect-error -- injecting window into worker global
  self.window = mockWindow;

  // Also make it available as globalThis.window for ES modules
  // @ts-expect-error -- injecting window into globalThis
  globalThis.window = mockWindow;

  // Also make HTMLElement available for instanceof checks
  // @ts-expect-error -- mock class for instanceof
  self.HTMLElement = class HTMLElement {};

  // textmode.js checks these constructors before it uploads canvas-backed
  // tilesets. Treat OffscreenCanvas as the worker equivalent of a canvas element.
  // @ts-expect-error -- worker-compatible DOM constructors
  self.HTMLCanvasElement = class HTMLCanvasElement {
    static [Symbol.hasInstance](value: unknown) {
      return value instanceof OffscreenCanvas;
    }
  };

  // @ts-expect-error -- mock class for instanceof checks
  self.HTMLImageElement = class HTMLImageElement {};

  // @ts-expect-error -- mock class for instanceof checks
  self.HTMLVideoElement = class HTMLVideoElement {};

  // textmode.js v0.18 loads its built-in tileset through `new Image()`.
  // OffscreenCanvas is a valid CanvasImageSource for the subsequent drawImage call.
  // @ts-expect-error -- worker-compatible Image substitute
  self.Image = class Image {
    constructor() {
      return createMockImage();
    }
  };

  isSetup = true;
}

/**
 * Clean up any resources created by the mocks.
 */
export function cleanupWorkerDOMMocks(): void {
  createdCanvases.length = 0;
  mockFonts.clear();
}
