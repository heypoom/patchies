<script lang="ts">
  import DOMPurify from 'dompurify';
  import { marked, addTargetBlankToLinks } from '$lib/objects/fetch-object-help';
  import 'katex/dist/katex.min.css';

  let { markdown, class: className = '' }: { markdown: string; class?: string } = $props();

  const html = $derived(
    DOMPurify.sanitize(addTargetBlankToLinks(marked.parse(markdown) as string), {
      ADD_TAGS: [
        'math',
        'mrow',
        'mi',
        'mo',
        'mn',
        'msup',
        'msub',
        'mfrac',
        'msubsup',
        'mover',
        'munder',
        'mtext',
        'annotation',
        'semantics'
      ],
      ADD_ATTR: ['xmlns', 'encoding', 'aria-hidden', 'focusable']
    })
  );
</script>

<div class="prose-markdown-app {className}">
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized with DOMPurify -->
  {@html html}
</div>
