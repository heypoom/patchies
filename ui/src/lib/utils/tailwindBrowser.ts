/**
 * Creates an isolated Shadow DOM container with Tailwind CSS for dom/vue nodes.
 * Adapted from @tailwindcss/browser to work with shadow DOM isolation.
 */

import { logger } from './logger';

type TailwindCompiler = Awaited<ReturnType<typeof import('./tailwindCompiler').compileTailwind>>;
let compilerPromise: Promise<TailwindCompiler> | null = null;

function ensureCompiler() {
  compilerPromise ??= import('./tailwindCompiler')
    .then(({ compileTailwind }) => compileTailwind())
    .catch((error) => {
      compilerPromise = null;
      throw error;
    });

  return compilerPromise;
}

/**
 * Manages Tailwind CSS for a single shadow DOM instance
 */
class ShadowTailwind {
  private compiler: TailwindCompiler | null = null;
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
    if (!this.compiler || this.destroyed) return;

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
    this.sheet.textContent = this.compiler.build(Array.from(this.classes));
  }

  async init() {
    try {
      this.compiler = await ensureCompiler();
    } catch (error) {
      if (!this.destroyed) logger.error('Failed to load browser Tailwind compiler', error);
      return;
    }

    if (this.destroyed) return;

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
    // Remove the stylesheet
    this.sheet.remove();
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

  // Forward xyflow interaction classes from inside shadow DOM.
  //
  // For `nowheel`: xyflow listens on the document in bubbling phase, so
  // stopping propagation here (inside shadow root, before the boundary) works.
  //
  // For `nodrag`/`nopan`: xyflow uses d3-drag's hasSelector(), which walks up
  // via parentElement from the retargeted event.target (shadow host). It never
  // enters the shadow tree, so it can't find classes on inner elements.
  // Fix: temporarily add the class to the shadow host so xyflow's walk finds it.
  shadow.addEventListener(
    'wheel',
    (event) => {
      if ((event.target as Element).closest?.('.nowheel')) {
        event.stopPropagation();
      }
    },
    { passive: false }
  );

  shadow.addEventListener('pointerdown', (e) => {
    const target = e.target as Element;

    for (const className of ['nodrag', 'nopan'] as const) {
      if (target.closest?.(`.${className}`)) {
        hostElement.classList.add(className);

        const cleanup = () => hostElement.classList.remove(className);
        document.addEventListener('pointerup', cleanup, { once: true });
        document.addEventListener('pointercancel', cleanup, { once: true });
      }
    }
  });

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
