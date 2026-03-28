<script lang="ts">
  import { page } from '$app/stores';
  import {
    ArrowLeft,
    BookOpen,
    Box,
    ChevronDown,
    ChevronRight,
    PanelLeft,
    PanelLeftClose
  } from '@lucide/svelte/icons';
  import DocsSearch from './DocsSearch.svelte';
  import type { Topic, ObjectItem, TopicsByCategory } from './docs-sidebar-types';

  interface Props {
    topics: Topic[];
    objects: ObjectItem[];
    topicsByCategory: TopicsByCategory;
    categoryOrder: string[];
    visible?: boolean;
  }

  let {
    topics,
    objects,
    topicsByCategory,
    categoryOrder,
    visible = $bindable(true)
  }: Props = $props();
  let guidesExpanded = $state(true);
  let objectsExpanded = $state(true);
  let sidebarContainer: HTMLDivElement | undefined = $state();

  const currentPath = $derived($page.url.pathname);

  // Auto-scroll to active item on mount/navigation
  $effect(() => {
    if (!sidebarContainer || !currentPath) return;

    // Use tick to ensure DOM is updated
    requestAnimationFrame(() => {
      const activeItem = sidebarContainer?.querySelector(
        '[data-active="true"]'
      ) as HTMLElement | null;

      if (activeItem && sidebarContainer) {
        // Use scrollTo on the container directly to avoid affecting parent scroll
        const containerRect = sidebarContainer.getBoundingClientRect();
        const itemRect = activeItem.getBoundingClientRect();
        const itemRelativeTop = itemRect.top - containerRect.top + sidebarContainer.scrollTop;
        const targetScroll = itemRelativeTop - containerRect.height / 2 + itemRect.height / 2;

        sidebarContainer.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: 'smooth'
        });
      }
    });
  });
</script>

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
    <div class="shrink-0 pb-4">
      <div class="mb-4 flex items-center justify-between">
        <a
          href="/"
          class="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 transition-colors hover:text-orange-400"
          style="font-family: 'Syne', sans-serif; letter-spacing: 0.04em;"
        >
          <ArrowLeft class="h-3.5 w-3.5" />
          Patchies
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
          class="mb-2 flex w-full cursor-pointer items-center gap-1.5 text-[10px] font-bold tracking-widest text-amber-600/80 uppercase transition-colors hover:text-amber-500"
          style="font-family: 'Syne', sans-serif;"
        >
          {#if guidesExpanded}
            <ChevronDown class="h-3 w-3" />
          {:else}
            <ChevronRight class="h-3 w-3" />
          {/if}
          <BookOpen class="h-3 w-3" />
          Guides
        </button>

        {#if guidesExpanded}
          <nav class="mt-4 space-y-3">
            {#each categoryOrder as category}
              {@const categoryTopics = topicsByCategory.get(category)}

              {#if categoryTopics && categoryTopics.length > 0}
                <div>
                  <div
                    class="mb-1 text-[9px] font-semibold tracking-widest text-zinc-600 uppercase"
                    style="font-family: 'Syne', sans-serif;"
                  >
                    {category}
                  </div>

                  <ul class="space-y-0.5">
                    {#each categoryTopics as topic}
                      {@const isActive = currentPath === `/docs/${topic.slug}`}
                      <li>
                        <a
                          href="/docs/{topic.slug}"
                          data-active={isActive}
                          class={[
                            'block border-l-2 py-1 pr-2 pl-1.5 text-sm transition-colors',
                            isActive
                              ? 'border-orange-500 bg-zinc-900/80 text-zinc-100'
                              : 'border-transparent text-zinc-500 hover:border-zinc-700 hover:bg-zinc-800/40 hover:text-zinc-300'
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
          class="mb-2 flex w-full cursor-pointer items-center gap-1.5 text-[10px] font-bold tracking-widest text-amber-600/80 uppercase transition-colors hover:text-amber-500"
          style="font-family: 'Syne', sans-serif;"
        >
          {#if objectsExpanded}
            <ChevronDown class="h-3 w-3" />
          {:else}
            <ChevronRight class="h-3 w-3" />
          {/if}
          <Box class="h-3 w-3" />
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
                    'block border-l-2 py-1 pr-2 pl-1.5 font-mono text-sm transition-colors',
                    isActive
                      ? 'border-orange-500 bg-zinc-900/80 text-zinc-100'
                      : 'border-transparent text-zinc-500 hover:border-zinc-700 hover:bg-zinc-800/40 hover:text-zinc-300'
                  ]}
                >
                  {object.title}
                </a>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  </div>
</aside>
