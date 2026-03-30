import type { SampleProvider, SampleResult } from './types';
import { TidalDrumMachinesProvider } from './providers/tidal-drum-machines';
import { DoughSamplesProvider } from './providers/dough-samples';
import { StrudelJsonProvider } from './providers/strudel-json';
import { SupersonicSamplesProvider } from './providers/supersonic-samples';
import { SupersonicSynthdefsProvider } from './providers/supersonic-synthdefs';
import { FreesoundProvider } from './providers/freesound';
import { SvelteSet } from 'svelte/reactivity';

const STRUDEL_PROVIDERS = [
  new StrudelJsonProvider({
    id: 'dirt-samples',
    name: 'Dirt Samples',
    indexUrl: 'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/strudel.json'
  }),
  new StrudelJsonProvider({
    id: 'spicule',
    name: 'Spicule',
    indexUrl: 'https://raw.githubusercontent.com/yaxu/spicule/master/strudel.json'
  }),
  new StrudelJsonProvider({
    id: 'clean-breaks',
    name: 'Clean Breaks',
    indexUrl: 'https://raw.githubusercontent.com/yaxu/clean-breaks/main/strudel.json'
  }),
  new StrudelJsonProvider({
    id: 'estuary-samples',
    name: 'Estuary Samples',
    indexUrl: 'https://raw.githubusercontent.com/felixroos/estuary-samples/main/strudel.json'
  }),
  new StrudelJsonProvider({
    id: 'dough-fox',
    name: 'Dough Fox',
    indexUrl: 'https://raw.githubusercontent.com/Bubobubobubobubo/Dough-Fox/main/strudel.json'
  }),
  new StrudelJsonProvider({
    id: 'dough-amen',
    name: 'Dough Amen',
    indexUrl: 'https://raw.githubusercontent.com/Bubobubobubobubo/Dough-Amen/main/strudel.json'
  }),
  new StrudelJsonProvider({
    id: 'dough-amiga',
    name: 'Dough Amiga',
    indexUrl: 'https://raw.githubusercontent.com/Bubobubobubobubo/Dough-Amiga/main/strudel.json'
  }),
  new StrudelJsonProvider({
    id: 'dough-samples-bubo',
    name: 'Dough Samples',
    indexUrl: 'https://raw.githubusercontent.com/Bubobubobubobubo/Dough-Samples/main/strudel.json'
  }),
  new StrudelJsonProvider({
    id: 'emptyflash-samples',
    name: 'Emptyflash Samples',
    indexUrl: 'https://raw.githubusercontent.com/emptyflash/samples/main/strudel.json'
  })
];

const MAX_RESULTS = 500;

export const freesoundProvider = new FreesoundProvider();

const ALL_PROVIDERS = [
  new TidalDrumMachinesProvider(),
  new DoughSamplesProvider(),
  ...STRUDEL_PROVIDERS,
  new SupersonicSamplesProvider(),
  new SupersonicSynthdefsProvider(),
  freesoundProvider
];

const ENABLED_PROVIDERS_KEY = 'sample-search:enabled-providers';
const DEFAULT_ENABLED = new Set(ALL_PROVIDERS.filter((p) => p.id !== 'freesound').map((p) => p.id));

function loadEnabledProviders(): Set<string> {
  try {
    const stored = localStorage.getItem(ENABLED_PROVIDERS_KEY);

    if (stored) {
      const ids = JSON.parse(stored) as string[];
      const valid = ids.filter((id): id is string => ALL_PROVIDERS.some((p) => p.id === id));

      if (valid.length > 0) return new Set(valid);
    }
  } catch {
    // ignore malformed storage
  }

  return new Set(DEFAULT_ENABLED);
}

class SampleSearchStore {
  query = $state('');
  results = $state<SampleResult[]>([]);
  isLoading = $state(false);
  error = $state<string | null>(null);
  playingId = $state<string | null>(null);
  selectedId = $state<string | null>(null);
  autoPreview = $state(localStorage.getItem('sample-search:auto-preview') === 'true');
  previewVolume = $state(Number(localStorage.getItem('sample-search:preview-volume') ?? '0.8'));

  /** Ordered list of all providers — read-only for the UI */
  readonly providers = ALL_PROVIDERS;

  /** Set of enabled provider ids — persisted to localStorage, Freesound off by default */
  enabledProviders = $state<Set<string>>(loadEnabledProviders());

  /** Number of providers that have successfully loaded their index */
  loadedCount = $state(0);

  /** Whether index loading has started */
  isIndexLoading = $state(false);

  private indexesLoaded = false;
  private indexLoadingPromise: Promise<void> | null = null;
  private currentAudio: HTMLAudioElement | null = null;

  toggleProvider(id: string): void {
    const next = new SvelteSet(this.enabledProviders);

    if (next.has(id)) {
      // Don't allow disabling the last one
      if (next.size === 1) return;
      next.delete(id);
    } else {
      next.add(id);
    }

    this.enabledProviders = next;
    localStorage.setItem(ENABLED_PROVIDERS_KEY, JSON.stringify([...next]));

    // Re-run search with current query against new filter
    if (this.query.trim()) {
      this.search(this.query);
    }
  }

  /** Eagerly load all provider indexes. Safe to call multiple times — only runs once. */
  loadIndexes(): Promise<void> {
    if (this.indexesLoaded) return Promise.resolve();
    if (this.indexLoadingPromise) return this.indexLoadingPromise;

    this.isIndexLoading = true;
    this.loadedCount = 0;

    this.indexLoadingPromise = (async () => {
      let successCount = 0;
      const failures: string[] = [];

      await Promise.all(
        this.providers.map(async (p) => {
          // Live providers (e.g. Freesound) have no index — skip and don't count toward successCount
          if ((p as SampleProvider).isLive) {
            this.loadedCount++;
            return;
          }

          if (p.isLoaded()) {
            successCount++;
            this.loadedCount++;
            return;
          }

          try {
            await p.loadIndex();
            successCount++;
          } catch (e) {
            failures.push(p.name);
            console.warn(`[sample-search] Failed to load ${p.name}:`, e);
          }

          this.loadedCount++;
        })
      );

      if (successCount === 0) {
        this.error = 'Could not load sample indexes. Check your connection.';
      } else {
        this.indexesLoaded = true;
      }

      this.isIndexLoading = false;

      if (failures.length > 0) {
        console.warn(
          `[sample-search] ${failures.length} provider(s) failed to load: ${failures.join(', ')}`
        );
      }
    })();

    return this.indexLoadingPromise;
  }

  async search(query: string): Promise<void> {
    this.query = query;
    const currentQuery = query;

    if (!query.trim()) {
      this.results = [];
      this.isLoading = false;
      this.error = null;

      return;
    }

    this.isLoading = true;
    this.error = null;

    // Ensure indexes are loaded (reuses in-flight promise if already loading)
    if (!this.indexesLoaded) {
      await this.loadIndexes();
    }

    if (this.query !== currentQuery) return;

    if (!this.indexesLoaded) {
      // loadIndexes set an error already
      this.isLoading = false;
      return;
    }

    // Run all enabled provider searches in parallel — failures are isolated per provider
    const enabledProviders = this.providers.filter((p) => this.enabledProviders.has(p.id));
    const settled = await Promise.allSettled(enabledProviders.map((p) => p.search(query)));
    const resultArrays = settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));

    if (this.query !== currentQuery) return;

    const allResults = resultArrays.flat();

    // Freesound results first when the provider is enabled
    const freesoundResults = allResults.filter((r) => r.provider === 'freesound');
    const otherResults = allResults.filter((r) => r.provider !== 'freesound');

    const sorted =
      freesoundResults.length > 0 ? [...freesoundResults, ...otherResults] : allResults;

    // Cap total results
    this.results = sorted.slice(0, MAX_RESULTS);
    this.isLoading = false;
  }

  selectSample(result: SampleResult, toggle = true): void {
    if (toggle && this.selectedId === result.id) {
      this.selectedId = null;
      return;
    }

    this.selectedId = result.id;

    if (this.autoPreview && result.kind !== 'synthdef') {
      this.playPreview(result);
    }
  }

  setAutoPreview(value: boolean): void {
    this.autoPreview = value;

    localStorage.setItem('sample-search:auto-preview', String(value));
  }

  setPreviewVolume(value: number): void {
    this.previewVolume = value;
    localStorage.setItem('sample-search:preview-volume', String(value));

    if (this.currentAudio) {
      this.currentAudio.volume = value;
    }
  }

  private playPreview(result: SampleResult): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }

    const audio = new Audio(result.url);
    audio.volume = this.previewVolume;

    this.currentAudio = audio;
    this.playingId = result.id;

    audio.play().catch(() => {
      if (this.currentAudio === audio) {
        this.playingId = null;
        this.currentAudio = null;
      }
    });

    audio.onended = () => {
      if (this.playingId === result.id && this.currentAudio === audio) {
        this.playingId = null;
      }

      if (this.currentAudio === audio) {
        this.currentAudio = null;
      }
    };
  }

  togglePreview(result: SampleResult): void {
    // If same sample, stop
    if (this.playingId === result.id) {
      this.stopPreview();
      return;
    }

    this.playPreview(result);
  }

  stopPreview(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }

    this.playingId = null;
  }

  isLoadingMore = $state(false);

  async loadMoreFromProvider(providerId: string): Promise<void> {
    const provider = this.providers.find((p) => p.id === providerId) as SampleProvider | undefined;
    if (!provider?.loadMore) return;

    const queryAtStart = this.query;
    this.isLoadingMore = true;

    try {
      const more = await provider.loadMore();

      // Discard if the query changed or the provider was disabled while loading
      if (this.query === queryAtStart && this.enabledProviders.has(providerId)) {
        this.results = [...this.results, ...more];
      }
    } finally {
      this.isLoadingMore = false;
    }
  }
}

export const sampleSearchStore = new SampleSearchStore();
