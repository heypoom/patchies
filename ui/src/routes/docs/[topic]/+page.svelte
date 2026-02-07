<script lang="ts">
  import { marked } from '$lib/objects/fetch-object-help';

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

<!-- Prose documentation from markdown -->
<section class="prose-markdown">
  {@html htmlContent}
</section>
