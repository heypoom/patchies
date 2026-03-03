import type { SampleProvider, SampleResult } from '../types';

type StrudelIndex = {
  _base: string;
  [key: string]: unknown;
};

/**
 * Generic provider for repos that use the strudel.json index format:
 * { "_base": "https://...", "categoryName": ["file1.wav", ...], ... }
 *
 * Used by yaxu/clean-breaks, yaxu/spicule, felixroos/estuary-samples,
 * Bubobubobubobubo/Dough-*, emptyflash/samples, etc.
 */
export class StrudelJsonProvider implements SampleProvider {
  readonly id: string;
  readonly name: string;
  private readonly indexUrl: string;

  private loaded = false;
  private samples: SampleResult[] = [];

  constructor(opts: { id: string; name: string; indexUrl: string }) {
    this.id = opts.id;
    this.name = opts.name;
    this.indexUrl = opts.indexUrl;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  async loadIndex(): Promise<void> {
    const response = await fetch(this.indexUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${this.id} index (${response.status}): ${this.indexUrl}`);
    }
    const data = (await response.json()) as StrudelIndex;
    const base: string = typeof data._base === 'string' ? data._base : '';
    const results: SampleResult[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (key === '_base') continue;

      const filenames = this.normalizeValue(value);

      for (let i = 0; i < filenames.length; i++) {
        const filename = filenames[i];
        const displayName = filename.split('/').pop() ?? filename;
        const ext = displayName.split('.').pop()?.toLowerCase();

        results.push({
          id: `${this.id}:${key}:${i}`,
          name: displayName,
          url: new URL(filename, base).toString(),
          format: ext,
          provider: this.id,
          category: key,
          index: i
        });
      }
    }

    this.samples = results;
    this.loaded = true;
  }

  /**
   * Normalize value shapes into a flat list of filenames.
   * Handles:
   *   - string:           "sound.wav"               → ["sound.wav"]
   *   - string[]:         ["a.wav", "b.wav"]         → ["a.wav", "b.wav"]
   *   - Record<k,string>: { c4: "c4.mp3", ... }      → ["c4.mp3", ...]
   *   - Record<k,str[]>:  { d2: ["a.wav","b.wav"] }  → ["a.wav","b.wav",...]
   * Skips nested objects with their own _base (note-mapped with custom bases).
   */
  private normalizeValue(value: unknown): string[] {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      // Skip entries that have their own _base (complex note-mapped format)
      if ('_base' in obj) return [];
      const out: string[] = [];
      for (const v of Object.values(obj)) {
        if (typeof v === 'string') out.push(v);
        else if (Array.isArray(v)) out.push(...v.filter((x): x is string => typeof x === 'string'));
      }
      return out;
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
