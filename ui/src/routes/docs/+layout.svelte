<script lang="ts">
  import { page } from '$app/stores';
  import { ArrowLeft, BookOpen, Box, ChevronDown, ChevronRight } from '@lucide/svelte/icons';
  import { categoryOrder, topicOrder } from './docs-nav';

  let { data, children } = $props();

  let guidesExpanded = $state(true);
  let objectsExpanded = $state(true);

  // Group topics by category and sort by topicOrder
  const topicsByCategory = $derived(() => {
    const groups = new Map<string, typeof data.index.topics>();

    for (const topic of data.index.topics) {
      const category = topic.category ?? 'Other';

      if (!groups.has(category)) {
        groups.set(category, []);
      }

      groups.get(category)!.push(topic);
    }

    // Sort topics within each category by topicOrder
    for (const [category, topics] of groups) {
      const order = topicOrder[category] ?? [];

      topics.sort((a, b) => {
        const aIndex = order.indexOf(a.slug);
        const bIndex = order.indexOf(b.slug);

        // Items not in order go to end
        const aPos = aIndex === -1 ? Infinity : aIndex;
        const bPos = bIndex === -1 ? Infinity : bIndex;

        return aPos - bPos;
      });
    }

    return groups;
  });

  // Get current path for active state
  const currentPath = $derived($page.url.pathname);
</script>

<div class="patchies-docs min-h-screen bg-zinc-950 text-zinc-200">
  <div class="mx-auto flex max-w-5xl gap-8 px-4 py-8">
    <!-- Sidebar -->
    <aside class="hidden w-56 shrink-0 md:block">
      <div class="sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto">
        <a
          href="/"
          class="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft class="h-4 w-4" />
          Back to Patchies
        </a>

        <a
          href="/docs"
          class="mb-6 block text-lg font-bold text-zinc-100 transition-colors hover:text-white"
        >
          Documentation
        </a>

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
                {@const topics = topicsByCategory().get(category)}

                {#if topics && topics.length > 0}
                  <div>
                    <div class="mb-1 text-xs text-zinc-600">{category}</div>

                    <ul class="space-y-0.5">
                      {#each topics as topic}
                        {@const isActive = currentPath === `/docs/${topic.slug}`}
                        <li>
                          <a
                            href="/docs/{topic.slug}"
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
              {#each data.index.objects as object}
                {@const isActive = currentPath === `/docs/objects/${object.slug}`}
                <li>
                  <a
                    href="/docs/objects/{object.slug}"
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
    </aside>

    <!-- Main content -->
    <main class="min-w-0 flex-1">
      {@render children()}
    </main>
  </div>
</div>
