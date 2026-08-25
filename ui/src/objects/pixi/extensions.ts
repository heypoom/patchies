const PIXI_EXTENSION_NAMES = [
  'accessibility',
  'advanced-blend-modes',
  'app',
  'basis',
  'dds',
  'dom',
  'events',
  'filters',
  'gif',
  'graphics',
  'ktx',
  'ktx2',
  'math-extras',
  'mesh',
  'particle-container',
  'prepare',
  'sprite-nine-slice',
  'sprite-tiling',
  'text',
  'text-bitmap',
  'text-html',
  'unsafe-eval'
] as const;

const PIXI_DOM_ONLY_EXTENSION_NAMES = ['accessibility', 'dom', 'events', 'text-html'];

const PIXI_WORKER_EXTENSION_NAMES = PIXI_EXTENSION_NAMES.filter(
  (extension) => !PIXI_DOM_ONLY_EXTENSION_NAMES.includes(extension)
);

type PixiExtensionName = (typeof PIXI_EXTENSION_NAMES)[number];

type PixiEnvironment = 'dom' | 'worker';

const extensionLoaders: Record<PixiExtensionName, () => Promise<unknown>> = {
  accessibility: () => import('pixi.js/accessibility'),
  'advanced-blend-modes': () => import('pixi.js/advanced-blend-modes'),
  app: () => import('pixi.js/app'),
  basis: () => import('pixi.js/basis'),
  dds: () => import('pixi.js/dds'),
  dom: () => import('pixi.js/dom'),
  events: () => import('pixi.js/events'),
  filters: () => import('pixi.js/filters'),
  gif: () => import('pixi.js/gif'),
  graphics: () => import('pixi.js/graphics'),
  ktx: () => import('pixi.js/ktx'),
  ktx2: () => import('pixi.js/ktx2'),
  'math-extras': () => import('pixi.js/math-extras'),
  mesh: () => import('pixi.js/mesh'),
  'particle-container': () => import('pixi.js/particle-container'),
  prepare: () => import('pixi.js/prepare'),
  'sprite-nine-slice': () => import('pixi.js/sprite-nine-slice'),
  'sprite-tiling': () => import('pixi.js/sprite-tiling'),
  text: () => import('pixi.js/text'),
  'text-bitmap': () => import('pixi.js/text-bitmap'),
  'text-html': () => import('pixi.js/text-html'),
  'unsafe-eval': () => import('pixi.js/unsafe-eval')
};

const enabledExtensions = new Set<PixiExtensionName>();
const extensionPromises = new Map<PixiExtensionName, Promise<unknown>>();

export const getPixiExtensionVersion = () => enabledExtensions.size;

export const loadPixiDomExtensions = (...extensions: string[]) =>
  loadPixiExtensions('dom', ...extensions);

export const loadPixiWorkerExtensions = (...extensions: string[]) =>
  loadPixiExtensions('worker', ...extensions);

async function loadPixiExtensions(environment: PixiEnvironment, ...extensions: string[]) {
  const availableExtensions =
    environment === 'dom' ? PIXI_EXTENSION_NAMES : PIXI_WORKER_EXTENSION_NAMES;
  const requestedExtensions = extensions.includes('all') ? availableExtensions : extensions;

  const browserOnlyExtension = requestedExtensions.find(
    (extension) => environment === 'worker' && PIXI_DOM_ONLY_EXTENSION_NAMES.includes(extension)
  );

  if (browserOnlyExtension) {
    throw new Error(
      `[pixi] "${browserOnlyExtension}" requires browser DOM infrastructure and is only available in pixi.dom.`
    );
  }

  const unknownExtension = requestedExtensions.find(
    (extension) => !Object.hasOwn(extensionLoaders, extension)
  );

  if (unknownExtension) {
    throw new Error(
      `[pixi] Unknown extension "${unknownExtension}". Use "all" or one of: ${availableExtensions.join(', ')}.`
    );
  }

  for (const extension of requestedExtensions as PixiExtensionName[]) {
    if (enabledExtensions.has(extension)) {
      continue;
    }

    let load = extensionPromises.get(extension);

    if (!load) {
      load = extensionLoaders[extension]();
      extensionPromises.set(extension, load);
    }

    try {
      await load;
      enabledExtensions.add(extension);
    } catch (error) {
      extensionPromises.delete(extension);
      throw error;
    }
  }
}
