import { SvelteSet } from 'svelte/reactivity';
import type { SampleResult } from './types';
import _ from 'lodash';
import { SAMPLE_TAG_PALETTE } from './constants';

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

function hashTag(tag: string): number {
  let h = 0;
  for (let i = 0; i < tag.length; i++) {
    h = Math.imul(31, h) + tag.charCodeAt(i);
  }
  return Math.abs(h);
}

export const getTagColor = (tag: string): (typeof SAMPLE_TAG_PALETTE)[number] =>
  SAMPLE_TAG_PALETTE[hashTag(tag) % SAMPLE_TAG_PALETTE.length];

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
    const tagSet = new SvelteSet<string>();

    for (const entry of Object.values(this.data)) {
      for (const tag of entry.tags) tagSet.add(tag);
    }

    return [...tagSet].sort();
  }

  /** Returns samples whose tags contain tagQuery (case-insensitive substring). Empty query returns all tagged. */
  getSamplesByTag(tagQuery: string): SampleResult[] {
    const query = tagQuery.toLowerCase().trim();
    const results: SampleResult[] = [];

    for (const entry of Object.values(this.data)) {
      if (!entry.tags.length) continue;

      if (query === '' || entry.tags.some((t) => t.toLowerCase().includes(query))) {
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
      this.data = _.omit(this.data, sampleId);
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
