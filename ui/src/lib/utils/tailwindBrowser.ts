/**
 * Creates an isolated Shadow DOM container with Tailwind CSS for dom/vue nodes.
 * Adapted from @tailwindcss/browser to work with shadow DOM isolation.
 */

import * as tailwindcss from 'tailwindcss';
import indexCss from 'tailwindcss/index.css?raw';
import preflightCss from 'tailwindcss/preflight.css?raw';
import themeCss from 'tailwindcss/theme.css?raw';
import utilitiesCss from 'tailwindcss/utilities.css?raw';

const css = {
	index: indexCss,
	preflight: preflightCss,
	theme: themeCss,
	utilities: utilitiesCss
};

// Shared compiler instance (reused across all shadow DOMs)
let compiler: Awaited<ReturnType<typeof tailwindcss.compile>> | null = null;
let compilerPromise: Promise<void> | null = null;

async function loadStylesheet(id: string, base: string) {
	if (id === 'tailwindcss') {
		return { path: 'virtual:tailwindcss/index.css', base, content: css.index };
	} else if (
		id === 'tailwindcss/preflight' ||
		id === 'tailwindcss/preflight.css' ||
		id === './preflight.css'
	) {
		return { path: 'virtual:tailwindcss/preflight.css', base, content: css.preflight };
	} else if (id === 'tailwindcss/theme' || id === 'tailwindcss/theme.css' || id === './theme.css') {
		return { path: 'virtual:tailwindcss/theme.css', base, content: css.theme };
	} else if (
		id === 'tailwindcss/utilities' ||
		id === 'tailwindcss/utilities.css' ||
		id === './utilities.css'
	) {
		return { path: 'virtual:tailwindcss/utilities.css', base, content: css.utilities };
	}
	throw new Error(`Unsupported @import "${id}"`);
}

async function ensureCompiler() {
	if (compiler) return;
	if (compilerPromise) return compilerPromise;

	compilerPromise = (async () => {
		compiler = await tailwindcss.compile('@import "tailwindcss";', {
			base: '/',
			loadStylesheet,
			loadModule: async () => {
				throw new Error('Plugins/config not supported');
			}
		});
	})();

	return compilerPromise;
}

/**
 * Manages Tailwind CSS for a single shadow DOM instance
 */
class ShadowTailwind {
	private shadow: ShadowRoot;
	private sheet: HTMLStyleElement;
	private classes = new Set<string>();
	private observer: MutationObserver;
	private buildQueued = false;

	constructor(shadow: ShadowRoot) {
		this.shadow = shadow;
		this.sheet = document.createElement('style');
		shadow.appendChild(this.sheet);

		// Observe class changes within this shadow DOM
		this.observer = new MutationObserver(() => this.queueBuild());
		this.observer.observe(shadow, {
			attributes: true,
			attributeFilter: ['class'],
			childList: true,
			subtree: true
		});
	}

	private queueBuild() {
		if (this.buildQueued) return;
		this.buildQueued = true;
		queueMicrotask(() => this.build());
	}

	private build() {
		this.buildQueued = false;
		if (!compiler) return;

		// Collect new classes from this shadow DOM
		const newClasses: string[] = [];
		for (const element of this.shadow.querySelectorAll('[class]')) {
			for (const c of element.classList) {
				if (!this.classes.has(c)) {
					this.classes.add(c);
					newClasses.push(c);
				}
			}
		}

		if (newClasses.length === 0 && this.sheet.textContent) return;

		// Build CSS for all known classes
		this.sheet.textContent = compiler.build(Array.from(this.classes));
	}

	async init() {
		await ensureCompiler();
		this.build();
	}

	destroy() {
		this.observer.disconnect();
	}
}

/**
 * Creates a shadow DOM container with Tailwind CSS isolated inside.
 * Returns the content root element where you should render your content.
 */
export function createIsolatedContainer(hostElement: HTMLElement): HTMLElement {
	// Clear any existing shadow root by replacing the host element's content
	// Note: We can't remove an existing shadow root, so we work around it
	if (hostElement.shadowRoot) {
		// Shadow root exists, just clear its contents
		hostElement.shadowRoot.innerHTML = '';
		const shadow = hostElement.shadowRoot;

		const tailwind = new ShadowTailwind(shadow);
		tailwind.init();

		const contentRoot = document.createElement('div');
		contentRoot.className = 'h-full w-full';
		shadow.appendChild(contentRoot);

		return contentRoot;
	}

	// Create new shadow root
	const shadow = hostElement.attachShadow({ mode: 'open' });

	const tailwind = new ShadowTailwind(shadow);
	tailwind.init();

	const contentRoot = document.createElement('div');
	contentRoot.className = 'h-full w-full';
	shadow.appendChild(contentRoot);

	return contentRoot;
}
