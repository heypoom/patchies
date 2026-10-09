<script lang="ts">
  import { onMount as mounted, onDestroy as destroyed } from 'svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';

  let {
    value,
    onMount,
    onDestroy
  }: {
    value: string;
    onMount: () => void;
    onDestroy: () => void;
  } = $props();

  mounted(() => onMount());
  destroyed(() => onDestroy());
</script>

<CodeEditor {value} nodeId="music-1" language="plain" />
