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
  private observer: MutationObserver | null = null;
  private buildQueued = false;
  private destroyed = false;

  constructor(shadow: ShadowRoot) {
    this.shadow = shadow;
    this.sheet = document.createElement('style');
    shadow.appendChild(this.sheet);
  }

  private queueBuild() {
    if (this.buildQueued || this.destroyed) return;
    this.buildQueued = true;
    queueMicrotask(() => this.build());
  }

  private build() {
    this.buildQueued = false;
    if (!compiler || this.destroyed) return;

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

    // Start observing class changes within this shadow DOM
    this.observer = new MutationObserver(() => this.queueBuild());
    this.observer.observe(this.shadow, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true
    });
  }

  destroy() {
    this.destroyed = true;
    this.observer?.disconnect();
    this.observer = null;
    // Clear the stylesheet content
    this.sheet.textContent = '';
  }
}

export interface IsolatedContainerResult {
  /** The content root element where you should render your content */
  root: HTMLElement;
  /** Call tailwind(false) to disable Tailwind and remove the MutationObserver */
  tailwind: (enabled: boolean) => void;
}

/**
 * Creates a shadow DOM container with Tailwind CSS isolated inside.
 * Tailwind is enabled by default. Call result.tailwind(false) to disable it.
 */
export function createIsolatedContainer(hostElement: HTMLElement): IsolatedContainerResult {
  let shadow: ShadowRoot;
  let tailwindInstance: ShadowTailwind | null = null;

  // Clear any existing shadow root by replacing the host element's content
  // Note: We can't remove an existing shadow root, so we work around it
  if (hostElement.shadowRoot) {
    // Shadow root exists, just clear its contents
    hostElement.shadowRoot.innerHTML = '';
    shadow = hostElement.shadowRoot;
  } else {
    // Create new shadow root
    shadow = hostElement.attachShadow({ mode: 'open' });
  }

  const contentRoot = document.createElement('div');
  contentRoot.className = 'h-full w-full';
  shadow.appendChild(contentRoot);

  // Enable Tailwind by default
  tailwindInstance = new ShadowTailwind(shadow);
  tailwindInstance.init();

  return {
    root: contentRoot,
    tailwind: (enabled: boolean) => {
      if (enabled && !tailwindInstance) {
        tailwindInstance = new ShadowTailwind(shadow);
        tailwindInstance.init();
      } else if (!enabled && tailwindInstance) {
        tailwindInstance.destroy();
        tailwindInstance = null;
      }
    }
  };
}
