<script lang="ts">
  import { page } from '$app/stores';
  import {
    ArrowLeft,
    BookOpen,
    Box,
    ChevronDown,
    ChevronRight,
    PanelLeft,
    PanelLeftClose,
    X
  } from '@lucide/svelte/icons';
  import { categoryOrder, topicOrder } from '../../../routes/docs/docs-nav';
  import DocsSearch from './DocsSearch.svelte';

  interface Topic {
    slug: string;
    title: string;
    category?: string;
  }

  interface ObjectItem {
    slug: string;
    title?: string;
  }

  interface Props {
    topics: Topic[];
    objects: ObjectItem[];
    visible?: boolean;
  }

  let { topics, objects, visible = $bindable(true) }: Props = $props();
  let guidesExpanded = $state(true);
  let objectsExpanded = $state(true);
  let sidebarContainer: HTMLDivElement | undefined = $state();
  let mobileOpen = $state(false);

  // Close mobile sidebar on navigation
  $effect(() => {
    $page.url.pathname;
    mobileOpen = false;
  });

  const currentPath = $derived($page.url.pathname);

  // Auto-scroll to active item on mount/navigation
  $effect(() => {
    if (!sidebarContainer || !currentPath) return;

    // Use tick to ensure DOM is updated
    requestAnimationFrame(() => {
      const activeItem = sidebarContainer?.querySelector('[data-active="true"]');

      activeItem?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  });

  const topicsByCategory = $derived(() => {
    const groups = new Map<string, Topic[]>();

    for (const topic of topics) {
      const category = topic.category ?? 'Other';

      if (!groups.has(category)) {
        groups.set(category, []);
      }

      groups.get(category)!.push(topic);
    }

    for (const [category, categoryTopics] of groups) {
      const order = topicOrder[category] ?? [];

      categoryTopics.sort((a, b) => {
        const aIndex = order.indexOf(a.slug);
        const bIndex = order.indexOf(b.slug);
        const aPos = aIndex === -1 ? Infinity : aIndex;
        const bPos = bIndex === -1 ? Infinity : bIndex;

        return aPos - bPos;
      });
    }

    return groups;
  });
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
            {@const categoryTopics = topicsByCategory().get(category)}

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

<!-- Desktop toggle button (visible when sidebar hidden) -->
<button
  onclick={() => (visible = true)}
  class="fixed top-8 left-4 z-10 hidden cursor-pointer rounded-lg bg-zinc-800/80 p-2 text-zinc-400 backdrop-blur-sm transition-all hover:bg-zinc-700 hover:text-zinc-200 md:block"
  class:opacity-0={visible}
  class:pointer-events-none={visible}
  title="Show sidebar"
>
  <PanelLeft class="h-5 w-5" />
</button>

<!-- Desktop Sidebar -->
<aside
  class="hidden shrink-0 transition-all duration-300 ease-in-out md:block"
  class:w-56={visible}
  class:mr-8={visible}
  class:w-0={!visible}
  class:opacity-0={!visible}
  class:overflow-hidden={!visible}
>
  <div class="sticky top-8 flex max-h-[calc(100vh-4rem)] w-56 flex-col">
    <!-- Sticky header -->
    <div class="shrink-0 bg-zinc-950 pb-4">
      <div class="mb-4 flex items-center justify-between">
        <a
          href="/"
          class="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft class="h-4 w-4" />
          Back to Patchies
        </a>
        <button
          onclick={() => (visible = false)}
          class="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          title="Hide sidebar"
        >
          <PanelLeftClose class="h-4 w-4" />
        </button>
      </div>

      <!-- Search -->
      <div class="mb-2">
        <DocsSearch {topics} {objects} />
      </div>
    </div>

    <!-- Scrollable content -->
    <div bind:this={sidebarContainer} class="min-h-0 flex-1 overflow-y-auto">
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
              {@const categoryTopics = topicsByCategory().get(category)}

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
                            'block rounded px-2 py-1 text-sm transition-colors',
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
                    'block rounded px-2 py-1 font-mono text-sm transition-colors',
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
    </div>
  </div>
</aside>
