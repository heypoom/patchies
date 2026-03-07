import type { SampleResult } from './types';

const STORAGE_KEY = 'patchies:sample-tags';

interface TaggedEntry {
  result: SampleResult;
  tags: string[];
}

type TagStorage = Record<string, TaggedEntry>;

function loadFromStorage(): TagStorage {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveToStorage(data: TagStorage): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

// ── tag color ────────────────────────────────────────────────────────────────

const TAG_PALETTE = [
  { text: 'text-cyan-400', bg: 'bg-cyan-900/30', dot: 'bg-cyan-400' },
  { text: 'text-purple-400', bg: 'bg-purple-900/30', dot: 'bg-purple-400' },
  { text: 'text-emerald-400', bg: 'bg-emerald-900/30', dot: 'bg-emerald-400' },
  { text: 'text-lime-400', bg: 'bg-lime-900/30', dot: 'bg-lime-400' },
  { text: 'text-amber-400', bg: 'bg-amber-900/30', dot: 'bg-amber-400' },
  { text: 'text-orange-400', bg: 'bg-orange-900/30', dot: 'bg-orange-400' },
  { text: 'text-rose-400', bg: 'bg-rose-900/30', dot: 'bg-rose-400' },
  { text: 'text-sky-400', bg: 'bg-sky-900/30', dot: 'bg-sky-400' },
  { text: 'text-violet-400', bg: 'bg-violet-900/30', dot: 'bg-violet-400' },
  { text: 'text-pink-400', bg: 'bg-pink-900/30', dot: 'bg-pink-400' },
  { text: 'text-teal-400', bg: 'bg-teal-900/30', dot: 'bg-teal-400' },
  { text: 'text-indigo-400', bg: 'bg-indigo-900/30', dot: 'bg-indigo-400' },
  { text: 'text-fuchsia-400', bg: 'bg-fuchsia-900/30', dot: 'bg-fuchsia-400' },
  { text: 'text-blue-400', bg: 'bg-blue-900/30', dot: 'bg-blue-400' },
  { text: 'text-red-400', bg: 'bg-red-900/30', dot: 'bg-red-400' }
];

function hashTag(tag: string): number {
  let h = 0;
  for (let i = 0; i < tag.length; i++) {
    h = Math.imul(31, h) + tag.charCodeAt(i);
  }
  return Math.abs(h);
}

export function getTagColor(tag: string): (typeof TAG_PALETTE)[number] {
  return TAG_PALETTE[hashTag(tag) % TAG_PALETTE.length];
}

// ── store ────────────────────────────────────────────────────────────────────

class SampleTagsStore {
  private data = $state<TagStorage>(loadFromStorage());

  getTags(sampleId: string): string[] {
    return this.data[sampleId]?.tags ?? [];
  }

  hasTag(sampleId: string, tag: string): boolean {
    return this.getTags(sampleId).includes(tag);
  }

  isTagged(sampleId: string): boolean {
    return (this.data[sampleId]?.tags.length ?? 0) > 0;
  }

  getAllTags(): string[] {
    const tagSet = new Set<string>();
    for (const entry of Object.values(this.data)) {
      for (const tag of entry.tags) tagSet.add(tag);
    }
    return [...tagSet].sort();
  }

  /** Returns samples whose tags contain tagQuery (case-insensitive substring). Empty query returns all tagged. */
  getSamplesByTag(tagQuery: string): SampleResult[] {
    const q = tagQuery.toLowerCase().trim();
    const results: SampleResult[] = [];
    for (const entry of Object.values(this.data)) {
      if (!entry.tags.length) continue;
      if (q === '' || entry.tags.some((t) => t.toLowerCase().includes(q))) {
        results.push(entry.result);
      }
    }
    return results;
  }

  addTag(result: SampleResult, tag: string): void {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const entry = this.data[result.id];
    if (entry?.tags.includes(trimmed)) return;
    this.data = {
      ...this.data,
      [result.id]: {
        result,
        tags: [...(entry?.tags ?? []), trimmed]
      }
    };
    saveToStorage(this.data);
  }

  removeTag(sampleId: string, tag: string): void {
    const entry = this.data[sampleId];
    if (!entry) return;
    const newTags = entry.tags.filter((t) => t !== tag);
    if (newTags.length === 0) {
      const { [sampleId]: _removed, ...rest } = this.data;
      this.data = rest;
    } else {
      this.data = { ...this.data, [sampleId]: { ...entry, tags: newTags } };
    }
    saveToStorage(this.data);
  }

  toggleTag(result: SampleResult, tag: string): void {
    if (this.hasTag(result.id, tag)) {
      this.removeTag(result.id, tag);
    } else {
      this.addTag(result, tag);
    }
  }
}

export const sampleTagsStore = new SampleTagsStore();
