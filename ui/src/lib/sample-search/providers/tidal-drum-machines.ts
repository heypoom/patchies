import type { SampleProvider, SampleResult } from '../types';

const INDEX_URL =
  'https://raw.githubusercontent.com/felixroos/dough-samples/main/tidal-drum-machines.json';

type TidalIndex = {
  _base: string;
  [key: string]: string | string[];
};

export class TidalDrumMachinesProvider implements SampleProvider {
  readonly id = 'tidal-drum-machines';
  readonly name = 'Tidal Drum Machines';

  private loaded = false;
  private samples: SampleResult[] = [];

  isLoaded(): boolean {
    return this.loaded;
  }

  async loadIndex(): Promise<void> {
    const response = await fetch(INDEX_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch tidal-drum-machines index: ${response.status}`);
    }

    const data = (await response.json()) as TidalIndex;
    const base = data._base as string;

    const results: SampleResult[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (key === '_base') continue;
      if (!Array.isArray(value)) continue;

      for (let i = 0; i < value.length; i++) {
        const relativePath = value[i];
        const filename = relativePath.split('/').pop() ?? relativePath;
        const ext = filename.split('.').pop()?.toLowerCase();

        results.push({
          id: `${this.id}:${key}:${i}`,
          name: filename,
          url: new URL(relativePath, base).toString(),
          format: ext,
          provider: this.id,
          category: key
        });
      }
    }

    this.samples = results;
    this.loaded = true;
  }

  search(query: string): SampleResult[] {
    if (!query.trim()) return [];

    const q = query.toLowerCase();
    const exact: SampleResult[] = [];
    const starts: SampleResult[] = [];
    const contains: SampleResult[] = [];

    for (const s of this.samples) {
      const name = s.name.toLowerCase();
      const cat = (s.category ?? '').toLowerCase();
      const combined = `${cat} ${name}`;

      if (name === q) {
        exact.push(s);
      } else if (name.startsWith(q) || cat.startsWith(q)) {
        starts.push(s);
      } else if (combined.includes(q)) {
        contains.push(s);
      }
    }

    return [...exact, ...starts, ...contains];
  }
}
