<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import {
    formatStartupDiagnostics,
    formatStartupResourceUrl,
    formatStartupSize,
    getStartupDiagnostics,
    startupDurationColor,
    startupSizeColor,
    type StartupDiagnosticsSnapshot
  } from '$lib/startup/startup-diagnostics';

  let {
    open = $bindable(false),
    snapshot = getStartupDiagnostics()
  }: {
    open: boolean;
    snapshot?: StartupDiagnosticsSnapshot;
  } = $props();

  let ranking = $state<'slowest' | 'largest'>('slowest');
  let copyStatus = $state('Copy report');
  const entries = $derived(snapshot?.[ranking] ?? []);

  async function copyReport() {
    if (!snapshot) return;

    try {
      await navigator.clipboard.writeText(formatStartupDiagnostics(snapshot));
      copyStatus = 'Copied';
    } catch {
      copyStatus = 'Could not copy report';
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
    <Dialog.Header>
      <Dialog.Title>Startup diagnostics</Dialog.Title>
      <Dialog.Description>
        Downloads recorded before the loading indicator dismissed. Top 100 by duration and size,
        plus every highlighted request.
      </Dialog.Description>
    </Dialog.Header>

    {#if snapshot}
      <p class="text-xs text-zinc-400">
        <span class="text-blue-300">{(snapshot.durationMs / 1000).toFixed(1)}s</span> startup ·
        {formatStartupSize(snapshot.downloadedBytes)} known downloaded ·
        {snapshot.resourceCount} completed resources
      </p>

      <div class="flex flex-wrap items-center gap-2">
        {#each ['slowest', 'largest'] as mode (mode)}
          <button
            type="button"
            aria-pressed={ranking === mode}
            class="cursor-pointer rounded-md px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
            class:bg-zinc-800={ranking === mode}
            class:text-zinc-100={ranking === mode}
            onclick={() => (ranking = mode as 'slowest' | 'largest')}
          >
            {mode === 'slowest' ? 'Slowest downloads' : 'Largest downloads'}
          </button>
        {/each}
      </div>

      <div class="max-h-[45vh] overflow-auto rounded-md border border-zinc-800">
        <table class="w-full text-left font-mono text-xs whitespace-nowrap">
          <caption class="sr-only"
            >{ranking === 'slowest' ? 'Slowest' : 'Largest'} startup downloads</caption
          >
          <thead class="sticky top-0 bg-zinc-900 text-zinc-400">
            <tr>
              <th scope="col" class="px-3 py-2 font-normal">Duration</th>
              <th scope="col" class="px-3 py-2 font-normal">Size</th>
              <th scope="col" class="px-3 py-2 font-normal">Resource</th>
            </tr>
          </thead>
          <tbody>
            {#each entries as entry (entry.id)}
              <tr class="border-t border-zinc-800/70 hover:bg-zinc-800/40">
                <td class={['px-3 py-2', startupDurationColor(entry.durationMs)]}
                  >{Math.round(entry.durationMs)}ms</td
                >
                <td class={['px-3 py-2', startupSizeColor(entry.encodedBodySize)]}
                  >{formatStartupSize(entry.encodedBodySize)}</td
                >
                <td class="px-3 py-2 text-zinc-300">{formatStartupResourceUrl(entry.url)}</td>
              </tr>
            {:else}
              <tr>
                <td colspan="3" class="px-3 py-6 font-sans text-zinc-400">
                  {ranking === 'largest'
                    ? 'No resource sizes were available to the browser.'
                    : 'No completed resources were recorded.'}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <details class="text-xs text-zinc-400">
        <summary
          class="cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-zinc-400"
        >
          Startup events · {snapshot.errors.length} errors ·
          {snapshot.pendingDownloads.length + snapshot.pendingImports.length} pending at dismissal
        </summary>
        <div class="mt-3 max-h-48 overflow-auto font-mono whitespace-pre">
          {#if snapshot.errors.length}
            <pre class="mb-3 text-red-300">{snapshot.errors.join('\n\n')}</pre>
          {/if}
          <pre>{snapshot.milestones.join('\n')}</pre>
          {#if snapshot.pendingDownloads.length}
            <p class="mt-3 text-zinc-300">Pending downloads</p>
            <pre>{snapshot.pendingDownloads
                .map((url) => formatStartupResourceUrl(url))
                .join('\n')}</pre>
          {/if}
          {#if snapshot.pendingImports.length}
            <p class="mt-3 text-zinc-300">Pending imports</p>
            <pre>{snapshot.pendingImports
                .map((url) => formatStartupResourceUrl(url))
                .join('\n')}</pre>
          {/if}
        </div>
      </details>

      <Dialog.Footer class="items-center gap-3 sm:justify-between">
        <p class="text-xs text-zinc-400">
          Request durations include waiting. Downloaded bytes can include cached resources.
        </p>
        <button
          type="button"
          onclick={copyReport}
          class="shrink-0 cursor-pointer rounded-md px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
          >{copyStatus}</button
        >
      </Dialog.Footer>
    {:else}
      <p class="py-4 text-sm text-zinc-400">
        No startup report is available for this page. Reload the patcher to capture a new startup.
      </p>
    {/if}
  </Dialog.Content>
</Dialog.Root>
