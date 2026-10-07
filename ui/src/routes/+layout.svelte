<script lang="ts">
  import { onMount } from 'svelte';
  import { ModeWatcher } from 'mode-watcher';
  import { page } from '$app/state';

  import {
    isStartupDiagnosticsOpen,
    loadStartupDiagnostics
  } from '../stores/startup-diagnostics.store';

  import '../app.css';

  let { children } = $props();

  onMount(() => {
    window.__patchiesStartup?.phase('Svelte mounted; waiting for the patcher canvas');

    if (page.error) window.__patchiesStartup?.errorPageMounted();
  });
</script>

<svelte:head>
  <title>Patchies</title>
</svelte:head>

<ModeWatcher />
{@render children()}

{#if $isStartupDiagnosticsOpen}
  {#await loadStartupDiagnostics() then diagnostics}
    {#if diagnostics}
      <diagnostics.default bind:open={$isStartupDiagnosticsOpen} />
    {/if}
  {/await}
{/if}
