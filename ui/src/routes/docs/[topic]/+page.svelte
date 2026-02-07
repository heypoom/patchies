<script lang="ts">
  import { marked } from '$lib/objects/fetch-object-help';
  import { ArrowLeft } from '@lucide/svelte/icons';

  let { data } = $props();

  const htmlContent = $derived(marked.parse(data.markdown) as string);

  // Convert topic slug to title (e.g., "javascript-runner" -> "JavaScript Runner")
  const title = $derived(
    data.topic
      .split('-')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  );
</script>

<svelte:head>
  <title>{title} - Patchies Documentation</title>
  <meta name="description" content="Patchies documentation: {title}" />
</svelte:head>

<div class="patchies-docs min-h-screen bg-zinc-950 text-zinc-200">
  <div class="mx-auto max-w-2xl px-4 py-8">
    <!-- Header -->
    <header class="mb-8">
      <a
        href="/"
        class="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <ArrowLeft class="h-4 w-4" />
        Back to Patchies
      </a>
    </header>

    <!-- Prose documentation from markdown -->
    <section class="prose-markdown">
      {@html htmlContent}
    </section>
  </div>
</div>
