<script lang="ts">
  import { page } from '$app/stores';
  import { ChevronLeft, ChevronRight } from '@lucide/svelte/icons';
  import { categoryOrder, topicOrder } from '../../../routes/docs/docs-nav';

  interface DocItem {
    slug: string;
    title: string;
    category?: string;
  }

  interface Props {
    topics: DocItem[];
    objects: DocItem[];
  }

  let { topics, objects }: Props = $props();

  // Build flat ordered list: guides first (by category order), then objects
  const orderedItems = $derived(() => {
    const items: Array<{ slug: string; title: string; href: string }> = [];

    // Add topics in category order
    for (const category of categoryOrder) {
      const categoryTopicSlugs = topicOrder[category] ?? [];

      for (const slug of categoryTopicSlugs) {
        const topic = topics.find((t) => t.slug === slug);
        if (topic) {
          items.push({
            slug: topic.slug,
            title: topic.title,
            href: `/docs/${topic.slug}`
          });
        }
      }
    }

    // Add objects
    for (const obj of objects) {
      items.push({
        slug: obj.slug,
        title: obj.title,
        href: `/docs/objects/${obj.slug}`
      });
    }

    return items;
  });

  const currentPath = $derived($page.url.pathname);

  const currentIndex = $derived(() => {
    return orderedItems().findIndex((item) => item.href === currentPath);
  });

  const prevItem = $derived(() => {
    const idx = currentIndex();
    return idx > 0 ? orderedItems()[idx - 1] : null;
  });

  const nextItem = $derived(() => {
    const idx = currentIndex();
    const items = orderedItems();
    return idx >= 0 && idx < items.length - 1 ? items[idx + 1] : null;
  });
</script>

{#if prevItem() || nextItem()}
  <nav class="mt-12 flex flex-col gap-3 border-t border-zinc-800 pt-6 sm:flex-row sm:gap-4">
    {#if prevItem()}
      {@const prev = prevItem()}

      {#if prev}
        <a
          href={prev.href}
          class="group flex min-w-0 flex-1 flex-col rounded-lg border border-zinc-800 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
        >
          <span class="mb-1 flex items-center gap-1 text-xs text-zinc-500">
            <ChevronLeft class="h-3 w-3" />
            Previous
          </span>
          <span
            class="truncate text-sm font-medium text-zinc-300 transition-colors group-hover:text-zinc-100"
          >
            {prev.title}
          </span>
        </a>
      {/if}
    {:else}
      <div class="hidden flex-1 sm:block"></div>
    {/if}

    {#if nextItem()}
      {@const next = nextItem()}

      {#if next}
        <a
          href={next.href}
          class="group flex min-w-0 flex-1 flex-col items-end rounded-lg border border-zinc-800 p-4 text-right transition-colors hover:border-zinc-700 hover:bg-zinc-900 sm:items-end"
        >
          <span class="mb-1 flex items-center gap-1 text-xs text-zinc-500">
            Next
            <ChevronRight class="h-3 w-3" />
          </span>
          <span
            class="truncate text-sm font-medium text-zinc-300 transition-colors group-hover:text-zinc-100"
          >
            {next.title}
          </span>
        </a>
      {/if}
    {:else}
      <div class="hidden flex-1 sm:block"></div>
    {/if}
  </nav>
{/if}
