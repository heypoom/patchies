<script lang="ts">
  import DOMPurify from 'dompurify';
  import { marked, addTargetBlankToLinks } from '$lib/objects/fetch-object-help';

  let { markdown, class: className = '' }: { markdown: string; class?: string } = $props();

  const html = $derived(
    DOMPurify.sanitize(addTargetBlankToLinks(marked.parse(markdown) as string))
  );
</script>

<div class="prose-markdown-sm {className}">
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized with DOMPurify -->
  {@html html}
</div>
