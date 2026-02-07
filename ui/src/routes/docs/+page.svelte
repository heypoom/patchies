<script lang="ts">
  import { ArrowLeft, BookOpen, Box } from '@lucide/svelte/icons';

  let { data } = $props();

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

  // Category order
  const categoryOrder = [
    'Getting Started',
    'Connections',
    'Audio & Video',
    'Scripting',
    'AI Features',
    'Managing Projects',
    'Sharing & Misc'
  ];
</script>

<svelte:head>
  <title>Documentation - Patchies</title>
  <meta name="description" content="Patchies documentation index" />
</svelte:head>

<div class="patchies-docs min-h-screen bg-zinc-950 text-zinc-200">
  <div class="mx-auto max-w-2xl px-4 py-8">
    <!-- Header -->
    <header class="mb-8">
      <a
        href="/"
        class="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <ArrowLeft class="h-4 w-4" />
        Back to Patchies
      </a>
      <h1 class="text-3xl font-bold text-zinc-100">Documentation</h1>
      <p class="mt-2 text-zinc-400">Learn how to use Patchies</p>
    </header>

    <!-- Topics Section -->
    <section class="mb-12">
      <div class="mb-4 flex items-center gap-2 text-zinc-400">
        <BookOpen class="h-5 w-5" />
        <h2 class="text-lg font-semibold">Guides</h2>
      </div>

      <div class="space-y-6">
        {#each categoryOrder as category}
          {@const topics = topicsByCategory().get(category)}
          {#if topics && topics.length > 0}
            <div>
              <h3 class="mb-2 text-sm font-medium text-zinc-500">{category}</h3>
              <ul class="space-y-1">
                {#each topics as topic}
                  <li>
                    <a
                      href="/docs/{topic.slug}"
                      class="block rounded-md px-3 py-2 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                    >
                      {topic.title}
                    </a>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        {/each}
      </div>
    </section>

    <!-- Objects Section -->
    <section class="mt-4">
      <div class="mb-4 flex items-center gap-2 text-zinc-400">
        <Box class="h-5 w-5" />
        <h2 class="text-lg font-semibold">Objects</h2>
      </div>

      <p class="mb-4 text-sm text-zinc-500">
        Detailed documentation for individual objects. More coming soon!
      </p>

      <ul class="space-y-1">
        {#each data.index.objects as object}
          <li>
            <a
              href="/docs/objects/{object.slug}"
              class="block rounded-md px-3 py-2 font-mono text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            >
              {object.slug}
            </a>
          </li>
        {/each}
      </ul>
    </section>
  </div>
</div>
