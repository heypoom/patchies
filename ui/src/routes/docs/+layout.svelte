<script lang="ts">
  import { page } from '$app/stores';
  import { ArrowLeft, BookOpen, Box } from '@lucide/svelte/icons';
  import { categoryOrder } from './docs-nav';

  let { data, children } = $props();

  // Group topics by category
  const topicsByCategory = $derived(() => {
    const groups = new Map<string, typeof data.index.topics>();
    for (const topic of data.index.topics) {
      const category = topic.category ?? 'Other';
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(topic);
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
          <div
            class="mb-4 flex items-center gap-1.5 text-xs font-medium tracking-wider text-zinc-500 uppercase"
          >
            <BookOpen class="h-3.5 w-3.5" />
            Guides
          </div>

          <nav class="space-y-3">
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
        </div>

        <!-- Objects Section -->
        <div>
          <div
            class="mb-4 flex items-center gap-1.5 text-xs font-medium tracking-wider text-zinc-500 uppercase"
          >
            <Box class="h-3.5 w-3.5" />
            Objects
          </div>

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
        </div>
      </div>
    </aside>

    <!-- Main content -->
    <main class="min-w-0 flex-1">
      {@render children()}
    </main>
  </div>
</div>
