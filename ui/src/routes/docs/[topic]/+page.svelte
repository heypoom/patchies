<script lang="ts">
  import { marked } from '$lib/objects/fetch-object-help';

  let { data } = $props();

  const htmlContent = $derived(marked.parse(data.markdown) as string);
</script>

<svelte:head>
  <title>{data.title} | Patchies</title>
  <meta name="description" content="Patchies documentation: {data.title}" />
</svelte:head>

<!-- Prose documentation from markdown -->
<section class="prose-markdown">
  {@html htmlContent}
</section>
