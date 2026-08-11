<script lang="ts">
  import { FolderOpen, Loader2 } from '@lucide/svelte/icons';
  import { onMount } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import ExampleCard from './ExampleCard.svelte';
  import StartupTabIntro from './StartupTabIntro.svelte';
  import type { ExampleCategory } from './types';

  let { onLoadPatch }: { onLoadPatch?: (patchId: string) => Promise<void> } = $props();

  let exampleCategories = $state<ExampleCategory[]>([]);
  let isLoadingExamples = $state(false);

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

  async function loadExample(patchId: string) {
    if (onLoadPatch) {
      await onLoadPatch(patchId);
    } else {
      // Fallback to URL navigation if function not provided
      // readonly=true is now the default for shared patches, no need to add it
      window.location.href = `/?id=${patchId}`;
    }
  }
</script>

<div class="examples-root">
  <StartupTabIntro
    title="Explore working patches."
    description="Open a demo across visuals, audio, or programming—then trace it, change it, and make it yours."
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
    {#each exampleCategories as category (category.name)}
      <section class="category-section">
        <div class="category-header">
          <h2>{category.name}</h2>
          <span
            >{category.patches.length} {category.patches.length === 1 ? 'patch' : 'patches'}</span
          >
        </div>

        <div class="examples-grid">
          {#each category.patches as patch (patch.id)}
            <ExampleCard {patch} onLoad={loadExample} />
          {/each}
        </div>
      </section>
    {/each}
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
    .category-header {
      padding-inline: 20px;
    }
    .examples-grid {
      grid-template-columns: 1fr;
      padding: 0 20px 24px;
    }
  }
</style>
