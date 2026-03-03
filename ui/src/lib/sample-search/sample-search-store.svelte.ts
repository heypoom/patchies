import type { SampleResult } from './types';
import { TidalDrumMachinesProvider } from './providers/tidal-drum-machines';
import { DoughSamplesProvider } from './providers/dough-samples';

const MAX_RESULTS = 500;

class SampleSearchStore {
  query = $state('');
  results = $state<SampleResult[]>([]);
  isLoading = $state(false);
  error = $state<string | null>(null);
  playingId = $state<string | null>(null);

  private providers = [new TidalDrumMachinesProvider(), new DoughSamplesProvider()];
  private indexesLoaded = false;
  private currentAudio: HTMLAudioElement | null = null;

  async search(query: string): Promise<void> {
    this.query = query;

    if (!query.trim()) {
      this.results = [];
      return;
    }

    this.isLoading = true;
    this.error = null;

    // Lazily load indexes on first search
    if (!this.indexesLoaded) {
      try {
        await Promise.all(this.providers.filter((p) => !p.isLoaded()).map((p) => p.loadIndex()));
        this.indexesLoaded = true;
      } catch (e) {
        this.error = 'Could not load sample indexes. Check your connection.';
        this.isLoading = false;
        return;
      }
    }

    // Collect results from all providers
    const allResults: SampleResult[] = [];
    for (const provider of this.providers) {
      const providerResults = await provider.search(query);
      allResults.push(...providerResults);
    }

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
      // Silently ignore playback errors (CORS, missing file, etc.)
      this.playingId = null;
      this.currentAudio = null;
    });

    audio.onended = () => {
      if (this.playingId === result.id) {
        this.playingId = null;
      }
      this.currentAudio = null;
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
