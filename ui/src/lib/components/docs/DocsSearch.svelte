<script lang="ts">
  import { onMount } from 'svelte';
  import Fuse from 'fuse.js';
  import { BookOpen, Box, Search } from '@lucide/svelte/icons';
  import * as Command from '$lib/components/ui/command';

  interface TopicItem {
    slug: string;
    title: string;
    category?: string;
  }

  interface ObjectItem {
    slug: string;
    title?: string;
  }

  interface Props {
    topics: TopicItem[];
    objects: ObjectItem[];
  }

  let { topics, objects }: Props = $props();
  let open = $state(false);

  // Build search index
  const searchItems = $derived([
    ...topics.map((t) => ({
      slug: t.slug,
      title: t.title,
      category: t.category,
      type: 'topic' as const,
      href: `/docs/${t.slug}`
    })),
    ...objects.map((o) => ({
      slug: o.slug,
      title: o.title ?? o.slug,
      category: undefined as string | undefined,
      type: 'object' as const,
      href: `/docs/objects/${o.slug}`
    }))
  ]);

  const fuse = $derived(
    new Fuse(searchItems, {
      keys: ['title', 'slug', 'category'],
      threshold: 0.3,
      includeScore: true
    })
  );

  let searchQuery = $state('');

  type SearchItem = (typeof searchItems)[number];

  const filteredResults = $derived.by(() => {
    if (!searchQuery.trim()) {
      // Show initial suggestions
      return {
        topics: searchItems.filter((i) => i.type === 'topic').slice(0, 5),
        objects: searchItems.filter((i) => i.type === 'object').slice(0, 8)
      };
    }

    const results = fuse.search(searchQuery);
    const filteredTopics: SearchItem[] = [];
    const filteredObjects: SearchItem[] = [];

    for (const result of results) {
      if (result.item.type === 'topic') {
        filteredTopics.push(result.item);
      } else {
        filteredObjects.push(result.item);
      }
    }

    return { topics: filteredTopics, objects: filteredObjects };
  });

  // Handle keyboard shortcut
  onMount(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        open = !open;
      }
    }

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });

  function handleSelect() {
    open = false;
    searchQuery = '';
  }

  // Clear search when dialog closes (escape, click outside)
  $effect(() => {
    if (!open && searchQuery) {
      searchQuery = '';
    }
  });
</script>

<!-- Search trigger button -->
<button
  onclick={() => (open = true)}
  class="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-500 transition-colors hover:border-zinc-700 hover:bg-zinc-800/50 hover:text-zinc-400"
>
  <Search class="h-4 w-4" />
  <span class="flex-1 text-left">Search docs...</span>
  <kbd
    class="hidden rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-500 sm:inline"
  >
    ⌘K
  </kbd>
</button>

<!-- Command palette dialog -->
<Command.Dialog
  bind:open
  shouldFilter={false}
  title="Search Documentation"
  description="Search through guides and object references"
>
  <Command.Input placeholder="Search docs..." bind:value={searchQuery} />
  <Command.List class="max-h-[400px]">
    <Command.Empty>No results found.</Command.Empty>

    {#if filteredResults.topics.length > 0}
      <Command.Group heading="Guides">
        {#each filteredResults.topics as topic (topic.slug)}
          <Command.LinkItem
            href={topic.href}
            onSelect={handleSelect}
            class="flex items-center gap-2"
          >
            <BookOpen class="h-4 w-4 text-zinc-500" />
            <span>{topic.title}</span>
            {#if topic.category}
              <span class="ml-auto text-xs text-zinc-600">{topic.category}</span>
            {/if}
          </Command.LinkItem>
        {/each}
      </Command.Group>
    {/if}

    {#if filteredResults.objects.length > 0}
      <Command.Group heading="Objects">
        {#each filteredResults.objects as item (item.slug)}
          <Command.LinkItem
            href={item.href}
            onSelect={handleSelect}
            class="flex items-center gap-2"
          >
            <Box class="h-4 w-4 text-zinc-500" />
            <span class="font-mono">{item.slug}</span>
            {#if item.title !== item.slug}
              <span class="ml-auto text-xs text-zinc-600">{item.title}</span>
            {/if}
          </Command.LinkItem>
        {/each}
      </Command.Group>
    {/if}
  </Command.List>
</Command.Dialog>
