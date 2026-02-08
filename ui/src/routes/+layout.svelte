<script lang="ts">
  import { onMount } from 'svelte';
  import { ModeWatcher } from 'mode-watcher';
  import '../app.css';

  let { children } = $props();

  onMount(async () => {
    if ('serviceWorker' in navigator) {
      const { registerSW } = await import('virtual:pwa-register');
      registerSW({ immediate: true });
    }
  });
</script>

<svelte:head>
  <title>Patchies</title>
</svelte:head>

<ModeWatcher />
{@render children()}
