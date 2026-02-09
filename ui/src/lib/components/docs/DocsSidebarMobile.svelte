<script lang="ts">
  import { page } from '$app/stores';
  import {
    ArrowLeft,
    BookOpen,
    Box,
    ChevronDown,
    ChevronRight,
    PanelLeft,
    X
  } from '@lucide/svelte/icons';
  import DocsSearch from './DocsSearch.svelte';
  import type { Topic, ObjectItem, TopicsByCategory } from './docs-sidebar-types';

  interface Props {
    topics: Topic[];
    objects: ObjectItem[];
    topicsByCategory: TopicsByCategory;
    categoryOrder: string[];
  }

  let { topics, objects, topicsByCategory, categoryOrder }: Props = $props();
  let guidesExpanded = $state(true);
  let objectsExpanded = $state(true);
  let mobileOpen = $state(false);

  // Close mobile sidebar on navigation
  $effect(() => {
    $page.url.pathname;
    mobileOpen = false;
  });

  const currentPath = $derived($page.url.pathname);
</script>

<!-- Mobile toggle button (visible on mobile only, bottom-right) -->
<button
  onclick={() => (mobileOpen = true)}
  class="fixed right-4 bottom-4 z-40 cursor-pointer rounded-full bg-zinc-800 p-3 text-zinc-300 shadow-lg transition-all hover:bg-zinc-700 hover:text-zinc-100 md:hidden"
  title="Open menu"
>
  <PanelLeft class="h-5 w-5" />
</button>

<!-- Mobile sidebar overlay -->
{#if mobileOpen}
  <!-- Backdrop -->
  <button
    onclick={() => (mobileOpen = false)}
    class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
    aria-label="Close menu"
  ></button>

  <!-- Mobile sidebar -->
  <aside class="fixed inset-0 z-50 overflow-y-auto bg-zinc-950 p-6 pb-20 md:hidden">
    <div class="mb-3">
      <a
        href="/"
        class="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <ArrowLeft class="h-4 w-4" />
        Back to Patchies
      </a>
    </div>

    <!-- Search -->
    <div class="mb-5">
      <DocsSearch {topics} {objects} />
    </div>

    <!-- Topics Section -->
    <div class="mb-6">
      <button
        onclick={() => (guidesExpanded = !guidesExpanded)}
        class="mb-2 flex w-full cursor-pointer items-center gap-1.5 text-xs font-medium tracking-wider text-zinc-500 uppercase transition-colors hover:text-zinc-400"
      >
        {#if guidesExpanded}
          <ChevronDown class="h-3.5 w-3.5" />
        {:else}
          <ChevronRight class="h-3.5 w-3.5" />
        {/if}
        <BookOpen class="h-3.5 w-3.5" />
        Guides
      </button>

      {#if guidesExpanded}
        <nav class="mt-4 space-y-3">
          {#each categoryOrder as category}
            {@const categoryTopics = topicsByCategory.get(category)}

            {#if categoryTopics && categoryTopics.length > 0}
              <div>
                <div class="mb-1 text-xs text-zinc-600">{category}</div>

                <ul class="space-y-0.5">
                  {#each categoryTopics as topic}
                    {@const isActive = currentPath === `/docs/${topic.slug}`}
                    <li>
                      <a
                        href="/docs/{topic.slug}"
                        data-active={isActive}
                        class={[
                          'block rounded px-2 py-1.5 text-sm transition-colors',
                          isActive
                            ? 'bg-zinc-800 text-zinc-100'
                            : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                        ]}
                      >
                        {topic.title}
                      </a>
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}
          {/each}
        </nav>
      {/if}
    </div>

    <!-- Objects Section -->
    <div>
      <button
        onclick={() => (objectsExpanded = !objectsExpanded)}
        class="mb-2 flex w-full cursor-pointer items-center gap-1.5 text-xs font-medium tracking-wider text-zinc-500 uppercase transition-colors hover:text-zinc-400"
      >
        {#if objectsExpanded}
          <ChevronDown class="h-3.5 w-3.5" />
        {:else}
          <ChevronRight class="h-3.5 w-3.5" />
        {/if}
        <Box class="h-3.5 w-3.5" />
        Objects
      </button>

      {#if objectsExpanded}
        <ul class="space-y-0.5">
          {#each objects as object}
            {@const isActive = currentPath === `/docs/objects/${object.slug}`}
            <li>
              <a
                href="/docs/objects/{object.slug}"
                data-active={isActive}
                class={[
                  'block rounded px-2 py-1.5 font-mono text-sm transition-colors',
                  isActive
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                ]}
              >
                {object.slug}
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <!-- Close FAB (same position as open button) -->
    <button
      onclick={() => (mobileOpen = false)}
      class="fixed right-4 bottom-4 z-50 cursor-pointer rounded-full bg-zinc-700 p-3 text-zinc-200 shadow-lg transition-all hover:bg-zinc-600 hover:text-zinc-100"
      title="Close menu"
    >
      <X class="h-5 w-5" />
    </button>
  </aside>
{/if}
