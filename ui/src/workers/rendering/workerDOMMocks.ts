/**
 * DOM mocks for Web Worker environment.
 * Required for libraries like textmode.js that expect browser APIs.
 */

// Track created canvases for potential cleanup
const createdCanvases: OffscreenCanvas[] = [];

// Mock FontFace storage (Web Workers have FontFace but not document.fonts)
const mockFonts = new Set<FontFace>();

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

	isSetup = true;
}

/**
 * Clean up any resources created by the mocks.
 */
export function cleanupWorkerDOMMocks(): void {
	createdCanvases.length = 0;
	mockFonts.clear();
}
