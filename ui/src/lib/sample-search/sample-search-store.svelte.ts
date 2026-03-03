import type { SampleResult } from './types';
import { TidalDrumMachinesProvider } from './providers/tidal-drum-machines';
import { DoughSamplesProvider } from './providers/dough-samples';
import { StrudelJsonProvider } from './providers/strudel-json';

const STRUDEL_PROVIDERS = [
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

const ALL_PROVIDERS = [
  new TidalDrumMachinesProvider(),
  new DoughSamplesProvider(),
  ...STRUDEL_PROVIDERS
];

class SampleSearchStore {
  query = $state('');
  results = $state<SampleResult[]>([]);
  isLoading = $state(false);
  error = $state<string | null>(null);
  playingId = $state<string | null>(null);

  /** Ordered list of all providers — read-only for the UI */
  readonly providers = ALL_PROVIDERS;

  /** Set of enabled provider ids — all enabled by default */
  enabledProviders = $state<Set<string>>(new Set(ALL_PROVIDERS.map((p) => p.id)));

  private indexesLoaded = false;
  private currentAudio: HTMLAudioElement | null = null;

  toggleProvider(id: string): void {
    const next = new Set(this.enabledProviders);
    if (next.has(id)) {
      // Don't allow disabling the last one
      if (next.size === 1) return;
      next.delete(id);
    } else {
      next.add(id);
    }
    this.enabledProviders = next;
    // Re-run search with current query against new filter
    if (this.query.trim()) this.search(this.query);
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

    // Lazily load indexes on first search — per-provider, non-blocking
    if (!this.indexesLoaded) {
      let successCount = 0;
      const failures: string[] = [];

      for (const p of this.providers) {
        if (p.isLoaded()) {
          successCount++;
          continue;
        }
        try {
          await p.loadIndex();
          successCount++;
        } catch (e) {
          failures.push(p.name);
          console.warn(`[sample-search] Failed to load ${p.name}:`, e);
        }
      }

      if (this.query !== currentQuery) return;

      if (successCount === 0) {
        this.error = 'Could not load sample indexes. Check your connection.';
        this.isLoading = false;
        return;
      }

      this.indexesLoaded = true;

      if (failures.length > 0) {
        console.warn(
          `[sample-search] ${failures.length} provider(s) failed to load: ${failures.join(', ')}`
        );
      }
    }

    if (this.query !== currentQuery) return;

    // Run all enabled provider searches in parallel
    const enabledProviders = this.providers.filter((p) => this.enabledProviders.has(p.id));
    const resultArrays = await Promise.all(enabledProviders.map((p) => p.search(query)));

    if (this.query !== currentQuery) return;

    const allResults = resultArrays.flat();

    // Cap total results
    this.results = allResults.slice(0, MAX_RESULTS);
    this.isLoading = false;
  }

  togglePreview(result: SampleResult): void {
    // Stop currently playing
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }

    // If same sample, just stop
    if (this.playingId === result.id) {
      this.playingId = null;
      return;
    }

    // Play new sample
    const audio = new Audio(result.url);
    this.currentAudio = audio;
    this.playingId = result.id;

    audio.play().catch(() => {
      // Only clear state if this audio instance is still the active one
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

  stopPreview(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.playingId = null;
  }
}

export const sampleSearchStore = new SampleSearchStore();
