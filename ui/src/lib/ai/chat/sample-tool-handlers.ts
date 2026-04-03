/**
 * Tool handlers for sample search (search_samples + search_freesound).
 *
 * Searches providers directly rather than going through the SampleSearchStore
 * to avoid mutating the sidebar's reactive UI state.
 */

import {
  sampleSearchStore,
  freesoundProvider
} from '$lib/sample-search/sample-search-store.svelte';

import type { SampleProvider, SampleResult } from '$lib/sample-search/types';
import { freesoundKeyStore } from '$lib/sample-search/freesound-key.store.svelte';

function formatSampleResult(r: SampleResult): Record<string, unknown> {
  const base: Record<string, unknown> = {
    name: r.name,
    category: r.category,
    url: r.url,
    kind: r.kind ?? 'sample',
    provider: r.provider
  };

  // Add strudel notation for strudel samples
  if ((!r.kind || r.kind === 'sample') && r.category != null && r.index != null) {
    base.strudelName = `${r.category}:${r.index}`;
    base.usage = `Use s("${r.category}:${r.index}") in strudel code, or load URL in soundfile~ node`;
  }

  // SuperSonic samples
  if (r.kind === 'sc-sample') {
    base.usage = `Use sample name "${r.name}" in sonic~ node`;
  }

  // SuperSonic synthdefs
  if (r.kind === 'synthdef') {
    base.synthdefName = r.url;
    base.usage = `Use synthdef name "${r.url}" in sonic~ node`;
  }

  return base;
}

export async function resolveSearchSamples(args: Record<string, unknown>): Promise<unknown> {
  const query = ((args.query as string) ?? '').trim();
  if (!query) return { results: [], total: 0 };

  const kindFilter = (args.kind as string) ?? 'all';
  const maxResults = Math.min(Math.max((args.maxResults as number) ?? 20, 1), 50);

  await sampleSearchStore.loadIndexes();

  const providers = sampleSearchStore.providers.filter((p) => {
    if ((p as SampleProvider).isLive) return false;

    if (kindFilter === 'strudel') {
      return p.id !== 'supersonic-samples' && p.id !== 'supersonic-synthdefs';
    }

    if (kindFilter === 'supersonic') {
      return p.id === 'supersonic-samples' || p.id === 'supersonic-synthdefs';
    }

    return true;
  });

  const settled = await Promise.allSettled(providers.map((p) => p.search(query)));

  const allResults = settled
    .flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
    .flat()
    .slice(0, maxResults);

  return {
    results: allResults.map(formatSampleResult),
    total: allResults.length,
    hint: 'For strudel nodes, use s("category:index"). For sonic~ nodes, use the sample or synthdef name. For soundfile~ nodes, use the URL.'
  };
}

export async function resolveSearchFreesound(args: Record<string, unknown>): Promise<unknown> {
  const query = ((args.query as string) ?? '').trim();
  if (!query) return { results: [], total: 0 };

  if (!freesoundKeyStore.hasKey) {
    return {
      error:
        'Freesound API key not configured. The user needs to set their Freesound API key in the Sample Search panel settings.'
    };
  }

  const maxResults = Math.min(Math.max((args.maxResults as number) ?? 10, 1), 30);

  const results = await freesoundProvider.search(query);

  const trimmed = (results as SampleResult[]).slice(0, maxResults);

  return {
    results: trimmed.map((r) => ({
      name: r.name,
      url: r.url,
      duration: r.duration,
      format: r.format,
      attribution: r.attribution,
      usage: `Load URL in soundfile~ node. Attribution required: ${r.attribution?.username} (${r.attribution?.license})`
    })),
    total: trimmed.length
  };
}
