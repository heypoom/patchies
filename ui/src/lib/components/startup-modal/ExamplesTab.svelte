<script lang="ts">
  import { FolderOpen, Loader2, Search, SearchX, X } from '@lucide/svelte/icons';
  import Fuse from 'fuse.js';
  import { onMount } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import ExampleCard from './ExampleCard.svelte';
  import StartupTabIntro from './StartupTabIntro.svelte';
  import type { ExampleCategory } from './types';

  let { onLoadPatch }: { onLoadPatch?: (slug: string) => Promise<void> } = $props();

  let exampleCategories = $state<ExampleCategory[]>([]);
  let isLoadingExamples = $state(false);
  let searchQuery = $state('');

  const examplePatches = $derived(exampleCategories.flatMap((category) => category.patches));
  const fuse = $derived(
    new Fuse(examplePatches, {
      keys: ['name', 'description', 'category', 'author'],
      threshold: 0.3,
      ignoreLocation: true
    })
  );
  const filteredCategories = $derived.by(() => {
    if (!searchQuery.trim()) return exampleCategories;

    const patchesByCategory = new SvelteMap<string, ExampleCategory['patches']>();

    for (const { item: patch } of fuse.search(searchQuery)) {
      const patches = patchesByCategory.get(patch.category) ?? [];
      patches.push(patch);
      patchesByCategory.set(patch.category, patches);
    }

    return exampleCategories.flatMap((category) => {
      const patches = patchesByCategory.get(category.name);
      return patches ? [{ ...category, patches }] : [];
    });
  });

  onMount(async () => {
    // Load example patches from static JSON file
    try {
      isLoadingExamples = true;
      const response = await fetch('/example-patches.json');
      const data = await response.json();

      // Group patches by category
      const categoryMap = new SvelteMap<string, ExampleCategory['patches']>();
      for (const patch of data.patches || []) {
        const category = patch.category || 'Uncategorized';
        if (!categoryMap.has(category)) {
          categoryMap.set(category, []);
        }
        categoryMap.get(category)!.push(patch);
      }

      // Convert to array format
      exampleCategories = Array.from(categoryMap.entries()).map(([name, patches]) => ({
        name,
        patches
      }));
    } catch (error) {
      console.error('Failed to load example patches:', error);
    } finally {
      isLoadingExamples = false;
    }
  });

  async function loadExample(slug: string) {
    if (onLoadPatch) {
      await onLoadPatch(slug);
    } else {
      window.location.href = `/?demo=${encodeURIComponent(slug)}`;
    }
  }
</script>

<div class="examples-root">
  <StartupTabIntro
    title="Explore working patches."
    description="Open a demo across visuals, audio, or programming. Play with it and make it yours."
  />

  {#if isLoadingExamples}
    <div class="examples-state" aria-live="polite">
      <Loader2 class="h-6 w-6 animate-spin text-zinc-500" />
      <p>Loading demos…</p>
    </div>
  {:else if exampleCategories.length === 0}
    <div class="examples-state">
      <FolderOpen class="h-8 w-8" />
      <p>No example patches available</p>
    </div>
  {:else}
    <div class="examples-search">
      <label for="example-patches-search" class="sr-only">Search demos</label>
      <Search class="examples-search-icon" aria-hidden="true" />
      <input
        id="example-patches-search"
        type="search"
        bind:value={searchQuery}
        placeholder="Search demos"
        autocomplete="off"
      />
      {#if searchQuery}
        <button
          type="button"
          class="examples-search-clear cursor-pointer"
          onclick={() => (searchQuery = '')}
          aria-label="Clear demo search"
        >
          <X class="h-4 w-4" aria-hidden="true" />
        </button>
      {/if}
    </div>

    {#if filteredCategories.length === 0}
      <div class="examples-state" aria-live="polite">
        <SearchX class="h-8 w-8" />
        <p>No demos match “{searchQuery}”</p>
      </div>
    {:else}
      {#each filteredCategories as category (category.name)}
        <section class="category-section">
          <div class="category-header">
            <h2>{category.name}</h2>
            <span
              >{category.patches.length} {category.patches.length === 1 ? 'patch' : 'patches'}</span
            >
          </div>

          <div class="examples-grid">
            {#each category.patches as patch (patch.slug)}
              <ExampleCard {patch} onLoad={loadExample} />
            {/each}
          </div>
        </section>
      {/each}
    {/if}
  {/if}
</div>

<style>
  .examples-root {
    min-height: 100%;
  }

  .examples-state {
    min-height: 240px;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 12px;
    color: #71717a;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.85rem;
  }

  .examples-search {
    position: relative;
    display: flex;
    align-items: center;
    margin: 20px 32px 0;
  }

  :global(.examples-search-icon) {
    position: absolute;
    left: 14px;
    width: 16px;
    height: 16px;
    color: #71717a;
    pointer-events: none;
  }

  .examples-search input {
    width: 100%;
    height: 42px;
    padding: 0 42px 0 40px;
    color: #f4f4f5;
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 8px;
    outline: none;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.85rem;
    transition:
      border-color 0.15s ease,
      background 0.15s ease;
  }

  .examples-search input::placeholder {
    color: #52525b;
  }

  .examples-search input:focus {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(249, 115, 22, 0.45);
  }

  .examples-search-clear {
    position: absolute;
    right: 6px;
    display: grid;
    width: 30px;
    height: 30px;
    place-content: center;
    color: #71717a;
    background: transparent;
    border: 0;
    border-radius: 6px;
  }

  .examples-search-clear:hover,
  .examples-search-clear:focus-visible {
    color: #f4f4f5;
    background: rgba(255, 255, 255, 0.07);
    outline: none;
  }

  .category-section {
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .category-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 32px 14px;
  }

  .category-header h2,
  .category-header span {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .category-header h2 {
    color: #d4d4d8;
  }
  .category-header span {
    color: #52525b;
  }

  .examples-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    padding: 0 32px 32px;
  }

  @media (max-width: 600px) {
    .examples-search {
      margin-inline: 20px;
    }

    .category-header {
      padding-inline: 20px;
    }
    .examples-grid {
      grid-template-columns: 1fr;
      padding: 0 20px 24px;
    }
  }
</style>
