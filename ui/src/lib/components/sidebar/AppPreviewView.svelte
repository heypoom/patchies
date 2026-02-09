<script lang="ts">
  import { X, ExternalLink, Copy, RefreshCw } from '@lucide/svelte/icons';
  import { appPreviewStore } from '../../../stores/app-preview.store';
  import { toast } from 'svelte-sonner';

  const preview = $derived($appPreviewStore);

  let iframeRef = $state<HTMLIFrameElement | null>(null);

  function clearPreview() {
    appPreviewStore.clear();
  }

  function refreshPreview() {
    if (iframeRef && preview.html) {
      // Force refresh by reassigning srcdoc
      iframeRef.srcdoc = preview.html;
    }
  }

  async function copyHtml() {
    if (!preview.html) return;

    try {
      await navigator.clipboard.writeText(preview.html);
      toast.success('HTML copied to clipboard');
    } catch {
      toast.error('Failed to copy HTML');
    }
  }

  function openInNewTab() {
    if (!preview.html) return;

    const blob = new Blob([preview.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');

    // Clean up after a delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
</script>

<div class="flex h-full flex-col">
  {#if preview.html}
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-zinc-700 px-3 py-2">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-zinc-200">
          {preview.name ?? 'App Preview'}
        </span>
      </div>

      <div class="flex items-center gap-1">
        <button
          onclick={refreshPreview}
          title="Refresh preview"
          class="cursor-pointer rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
        >
          <RefreshCw class="h-4 w-4" />
        </button>

        <button
          onclick={copyHtml}
          title="Copy HTML"
          class="cursor-pointer rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
        >
          <Copy class="h-4 w-4" />
        </button>

        <button
          onclick={openInNewTab}
          title="Open in new tab"
          class="cursor-pointer rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
        >
          <ExternalLink class="h-4 w-4" />
        </button>

        <button
          onclick={clearPreview}
          title="Close preview"
          class="cursor-pointer rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-red-400"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </div>

    <!-- Preview iframe -->
    <div class="flex-1 bg-zinc-900">
      <iframe
        bind:this={iframeRef}
        srcdoc={preview.html}
        title="App Preview"
        class="h-full w-full border-0"
        sandbox="allow-scripts allow-same-origin"
      ></iframe>
    </div>
  {:else}
    <!-- Empty state -->
    <div class="flex h-full flex-col items-center justify-center p-4 text-center">
      <p class="text-sm text-zinc-400">No preview available</p>
      <p class="mt-1 text-xs text-zinc-500">Use "Patch to Prompt" to generate an app preview</p>
    </div>
  {/if}
</div>
