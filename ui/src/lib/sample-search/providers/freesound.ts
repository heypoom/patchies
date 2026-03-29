import type { SampleProvider, SampleResult } from '../types';

const FREESOUND_API = 'https://freesound.org/apiv2/search/text/';
const PAGE_SIZE = 50;
const FIELDS = 'id,name,username,duration,type,tags,license,previews';

type FreesoundSound = {
  id: number;
  name: string;
  username: string;
  duration: number;
  type: string;
  tags: string[];
  license: string;
  previews: { 'preview-hq-mp3': string };
};

type FreesoundResponse = {
  count: number;
  next: string | null;
  results: FreesoundSound[];
};

function shortenLicense(url: string): string {
  if (url.includes('zero')) return 'CC0';
  if (url.includes('by-nc-sa')) return 'CC BY-NC-SA';
  if (url.includes('by-nc')) return 'CC BY-NC';
  if (url.includes('by-sa')) return 'CC BY-SA';
  if (url.includes('by')) return 'CC BY';

  return 'Other';
}

export class FreesoundProvider implements SampleProvider {
  readonly id = 'freesound';
  readonly name = 'Freesound';

  private nextUrl: string | null = null;

  isLoaded(): boolean {
    return true; // live API, always ready
  }

  async loadIndex(): Promise<void> {
    // No index to load — searches hit the live API
  }

  getApiKey(): string {
    return localStorage.getItem('freesound:api-key') ?? '';
  }

  private mapResults(sounds: FreesoundSound[]): SampleResult[] {
    return sounds.map((s) => ({
      id: `freesound:${s.id}`,
      name: s.name,
      url: s.previews['preview-hq-mp3'],
      duration: s.duration,
      format: s.type,
      provider: 'freesound',
      category: 'freesound',
      attribution: {
        username: s.username,
        license: shortenLicense(s.license),
        freesoundId: s.id
      }
    }));
  }

  async search(query: string): Promise<SampleResult[]> {
    const apiKey = this.getApiKey();
    if (!apiKey || !query.trim()) return [];

    const url = new URL(FREESOUND_API);
    url.searchParams.set('query', query);
    url.searchParams.set('token', apiKey);
    url.searchParams.set('page_size', String(PAGE_SIZE));
    url.searchParams.set('fields', FIELDS);

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Freesound search failed: ${response.status}`);

    const data = (await response.json()) as FreesoundResponse;
    this.nextUrl = data.next;

    return this.mapResults(data.results);
  }

  hasMore(): boolean {
    return this.nextUrl !== null;
  }

  async loadMore(): Promise<SampleResult[]> {
    if (!this.nextUrl) return [];

    const apiKey = this.getApiKey();
    if (!apiKey) return [];

    // Freesound strips the token from `next` URLs — re-add it
    const url = new URL(this.nextUrl);
    url.searchParams.set('token', apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Freesound load more failed: ${response.status}`);

    const data = (await response.json()) as FreesoundResponse;
    this.nextUrl = data.next;

    return this.mapResults(data.results);
  }
}
