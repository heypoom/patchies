<script lang="ts">
  import { onMount } from 'svelte';
  import { ModeWatcher } from 'mode-watcher';
  import { unregisterAllServiceWorkers } from '$lib/service-worker/unregister';

  import '../app.css';

  let { children } = $props();

  // HOTFIX: Unregister all service workers to fix aggressive caching issues
  onMount(() => unregisterAllServiceWorkers());
</script>

<svelte:head>
  <title>Patchies</title>
</svelte:head>

<ModeWatcher />
{@render children()}
