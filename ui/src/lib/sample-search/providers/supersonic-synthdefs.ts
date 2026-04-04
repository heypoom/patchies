import type { SampleProvider, SampleResult } from '../types';
import { SYNTHDEF_NAMES } from '$lib/audio/supersonic-synthdefs';

/** Derive a category prefix from a synthdef name for grouping.
 * "sonic-pi-fx_reverb" → "fx", "sonic-pi-beep" → "synths", "fft_brickwall" → "fft" */
function categoryFromName(name: string): string {
  if (name.startsWith('sonic-pi-fx_')) return 'fx';
  if (name.startsWith('sonic-pi-sc808_')) return 'sc808';
  if (name.startsWith('sonic-pi-mod_')) return 'mod';
  if (name.startsWith('sonic-pi-')) return 'synths';
  if (name.startsWith('fft_')) return 'fft';
  return 'other';
}

export class SupersonicSynthdefsProvider implements SampleProvider {
  readonly id = 'supersonic-synthdefs';
  readonly name = 'SuperSonic SynthDefs';

  private loaded = false;
  private defs: SampleResult[] = [];

  isLoaded(): boolean {
    return this.loaded;
  }

  async loadIndex(): Promise<void> {
    this.defs = SYNTHDEF_NAMES.map((name) => ({
      id: `${this.id}:${name}`,
      // Display name strips the "sonic-pi-" prefix for readability
      name: name.startsWith('sonic-pi-') ? name.slice('sonic-pi-'.length) : name,
      // url holds the raw synthdef name (used to build sonic~ boilerplate on drag)
      url: name,
      provider: this.id,
      category: categoryFromName(name),
      kind: 'synthdef' as const
    }));
    this.loaded = true;
  }

  search(query: string): SampleResult[] {
    if (!query.trim()) return [];

    const q = query.toLowerCase();
    const exact: SampleResult[] = [];
    const starts: SampleResult[] = [];
    const contains: SampleResult[] = [];

    for (const s of this.defs) {
      const name = s.name.toLowerCase();
      const cat = (s.category ?? '').toLowerCase();
      // Also search against the full synthdef name stored in url
      const full = s.url.toLowerCase();

      if (name === q || full === q) {
        exact.push(s);
      } else if (name.startsWith(q) || full.startsWith(q) || cat.startsWith(q)) {
        starts.push(s);
      } else if (name.includes(q) || full.includes(q) || cat.includes(q)) {
        contains.push(s);
      }
    }

    return [...exact, ...starts, ...contains];
  }
}
