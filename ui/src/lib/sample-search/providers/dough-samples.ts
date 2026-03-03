import type { SampleProvider, SampleResult } from '../types';

const REPO_BASE = 'https://raw.githubusercontent.com/felixroos/dough-samples/main';

// Known JSON indexes in the dough-samples repo.
// Each has a _base URL and either:
//   - flat object: { sampleName: "filename.ext" }
//   - or arrays:   { sampleName: ["file1.ext", "file2.ext"] }
const INDEX_FILES = [
  'piano.json',
  'EmuSP12.json',
  'mridangam.json',
  'vcsl.json',
  'Dirt-Samples.json'
] as const;

type DoughIndex = {
  _base: string;
  [key: string]: string | string[] | Record<string, string>;
};

export class DoughSamplesProvider implements SampleProvider {
  readonly id = 'dough-samples';
  readonly name = 'Dough Samples';

  private loaded = false;
  private samples: SampleResult[] = [];

  isLoaded(): boolean {
    return this.loaded;
  }

  async loadIndex(): Promise<void> {
    const results: SampleResult[] = [];

    // Fetch all indexes in parallel, skip failures gracefully
    const fetches = await Promise.allSettled(
      INDEX_FILES.map((file) =>
        fetch(`${REPO_BASE}/${file}`).then((r) => r.json() as Promise<DoughIndex>)
      )
    );

    for (let fi = 0; fi < fetches.length; fi++) {
      const result = fetches[fi];
      if (result.status === 'rejected') continue;

      const data = result.value;
      const base: string = data._base ?? '';

      for (const [key, value] of Object.entries(data)) {
        if (key === '_base') continue;

        const filenames = this.normalizeValue(value);

        for (let i = 0; i < filenames.length; i++) {
          const filename = filenames[i];
          const displayName = filename.split('/').pop() ?? filename;
          const ext = displayName.split('.').pop()?.toLowerCase();

          results.push({
            id: `${this.id}:${INDEX_FILES[fi]}:${key}:${i}`,
            name: displayName,
            url: base + filename,
            format: ext,
            provider: this.id,
            category: key
          });
        }
      }
    }

    this.samples = results;
    this.loaded = true;
  }

  /**
   * Normalize the various value shapes in dough-samples indexes into a flat list of filenames.
   * Handles:
   *   - string:            "A0v8.mp3"                    → ["A0v8.mp3"]
   *   - string[]:          ["kick.wav", "kick2.wav"]     → ["kick.wav", "kick2.wav"]
   *   - Record<k,string>:  { A0: "A0v8.mp3", ... }      → ["A0v8.mp3", ...]
   */
  private normalizeValue(value: unknown): string[] {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
    if (value && typeof value === 'object') {
      return Object.values(value as Record<string, unknown>).filter(
        (v): v is string => typeof v === 'string'
      );
    }
    return [];
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
