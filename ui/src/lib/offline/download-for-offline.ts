export interface OfflineDownloadProgress {
  current: number;
  total: number;
  currentItem: string;
  status: 'idle' | 'downloading' | 'complete' | 'error';
  error?: string;
}

const OFFLINE_RESOURCES = {
  ruby: [
    'https://cdn.jsdelivr.net/npm/@ruby/wasm-wasi@2.8.1/dist/browser/+esm',
    'https://cdn.jsdelivr.net/npm/@ruby/4.0-wasm-wasi@2.8.1/dist/ruby+stdlib.wasm'
  ],
  supersonic: [
    // Core packages - these will trigger caching of additional resources
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

export async function downloadForOffline(
  onProgress?: (progress: OfflineDownloadProgress) => void
): Promise<void> {
  const allUrls = [
    ...OFFLINE_RESOURCES.ruby,
    ...OFFLINE_RESOURCES.supersonic,
    ...OFFLINE_RESOURCES.strudel,
    ...OFFLINE_RESOURCES.vdoninja
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
      await fetch(url, { cache: 'reload' }); // Force fetch to populate cache
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

export function getOfflineResourceCount(): number {
  return (
    OFFLINE_RESOURCES.ruby.length +
    OFFLINE_RESOURCES.supersonic.length +
    OFFLINE_RESOURCES.strudel.length +
    OFFLINE_RESOURCES.vdoninja.length
  );
}
