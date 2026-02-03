export interface OfflineDownloadProgress {
  current: number;
  total: number;
  currentItem: string;
  status: 'idle' | 'downloading' | 'complete' | 'error';
  error?: string;
}

// Local WASM/heavy assets (relative to origin)
const LOCAL_RESOURCES = [
  // WebChuck
  '/webchuck/webchuck.js',
  '/webchuck/webchuck.wasm',
  '/webchuck/wc-bundle.js',

  // Pyodide (Python)
  '/assets/pyodide.js',
  '/assets/pyodide.asm.js',
  '/assets/pyodide.asm.wasm',
  '/assets/python_stdlib.zip',
  '/assets/pyodide-lock.json',

  // P5 compatibility layer
  '/lib/p5/compat/preload.js',
  '/lib/p5/compat/shapes.js',
  '/lib/p5/compat/data.js'
];

// CDN-hosted resources
const CDN_RESOURCES = {
  ruby: [
    'https://cdn.jsdelivr.net/npm/@ruby/wasm-wasi@2.8.1/dist/browser/+esm',
    'https://cdn.jsdelivr.net/npm/@ruby/4.0-wasm-wasi@2.8.1/dist/ruby+stdlib.wasm'
  ],
  supersonic: [
    'https://unpkg.com/supersonic-scsynth-core@0.25.5/package.json',
    'https://unpkg.com/supersonic-scsynth-samples@0.25.5/package.json',
    'https://unpkg.com/supersonic-scsynth-synthdefs@0.25.5/package.json'
  ],
  strudel: [
    'https://raw.githubusercontent.com/felixroos/dough-samples/main/tidal-drum-machines.json',
    'https://raw.githubusercontent.com/felixroos/dough-samples/main/piano.json',
    'https://raw.githubusercontent.com/felixroos/dough-samples/main/Dirt-Samples.json',
    'https://raw.githubusercontent.com/felixroos/dough-samples/main/EmuSP12.json',
    'https://raw.githubusercontent.com/felixroos/dough-samples/main/vcsl.json',
    'https://raw.githubusercontent.com/felixroos/dough-samples/main/mridangam.json',
    'https://raw.githubusercontent.com/todepond/samples/main/tidal-drum-machines-alias.json'
  ],
  vdoninja: ['https://cdn.jsdelivr.net/gh/steveseguin/ninjasdk@latest/vdoninja-sdk.min.js']
};

/** Discover app JS files from the current document */
function discoverAppScripts(): string[] {
  const scripts = new Set<string>();

  // Get all script tags with src
  document.querySelectorAll('script[src]').forEach((script) => {
    const src = script.getAttribute('src');
    if (src) {
      scripts.add(src);
    }
  });

  // Get all modulepreload links (SvelteKit preloads chunks this way)
  document.querySelectorAll('link[rel="modulepreload"]').forEach((link) => {
    const href = link.getAttribute('href');
    if (href) {
      scripts.add(href);
    }
  });

  // Get stylesheets too
  document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    const href = link.getAttribute('href');
    if (href) {
      scripts.add(href);
    }
  });

  return Array.from(scripts);
}

export async function downloadForOffline(
  onProgress?: (progress: OfflineDownloadProgress) => void
): Promise<void> {
  // Discover app scripts dynamically
  const appScripts = discoverAppScripts();

  const allUrls = [
    ...appScripts,
    ...LOCAL_RESOURCES,
    ...CDN_RESOURCES.ruby,
    ...CDN_RESOURCES.supersonic,
    ...CDN_RESOURCES.strudel,
    ...CDN_RESOURCES.vdoninja
  ];

  let completed = 0;

  onProgress?.({
    current: 0,
    total: allUrls.length,
    currentItem: '',
    status: 'downloading'
  });

  for (const url of allUrls) {
    const itemName = url.split('/').pop() || url;

    onProgress?.({
      current: completed,
      total: allUrls.length,
      currentItem: itemName,
      status: 'downloading'
    });

    try {
      // Normal fetch - service worker will intercept and cache via runtimeCaching rules
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Failed to fetch: ${url} (${response.status})`);
      }
      completed++;
    } catch (e) {
      console.warn(`Failed to cache: ${url}`, e);
      completed++;
    }
  }

  onProgress?.({
    current: completed,
    total: allUrls.length,
    currentItem: '',
    status: 'complete'
  });
}

/** Returns estimated count (actual count includes dynamically discovered scripts) */
export function getOfflineResourceCount(): number {
  return (
    LOCAL_RESOURCES.length +
    CDN_RESOURCES.ruby.length +
    CDN_RESOURCES.supersonic.length +
    CDN_RESOURCES.strudel.length +
    CDN_RESOURCES.vdoninja.length +
    20 // Estimated app scripts
  );
}
