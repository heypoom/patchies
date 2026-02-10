<script lang="ts">
  import {
    X,
    ExternalLink,
    Copy,
    RefreshCw,
    Download,
    Sparkles,
    Code,
    FileText,
    FileCode
  } from '@lucide/svelte/icons';
  import * as Popover from '$lib/components/ui/popover';
  import { appPreviewStore } from '../../../stores/app-preview.store';
  import { hasGeminiApiKey } from '$lib/ai/patch-to-prompt';
  import { toast } from 'svelte-sonner';
  import AiPreviewEditDialog from '../dialogs/AiPreviewEditDialog.svelte';

  let {
    onRequestApiKey,
    onOpenPatchToApp
  }: {
    onRequestApiKey?: (onKeyReady: () => void) => void;
    onOpenPatchToApp?: () => void;
  } = $props();

  const preview = $derived($appPreviewStore);

  let iframeRef = $state<HTMLIFrameElement | null>(null);
  let showEditDialog = $state(false);
  let copyMenuOpen = $state(false);
  let downloadMenuOpen = $state(false);

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
      copyMenuOpen = false;
    } catch {
      toast.error('Failed to copy HTML');
    }
  }

  async function copySpec() {
    if (!preview.spec) return;

    try {
      await navigator.clipboard.writeText(preview.spec);
      toast.success('Spec copied to clipboard');
      copyMenuOpen = false;
    } catch {
      toast.error('Failed to copy spec');
    }
  }

  function downloadHtml() {
    if (!preview.html) return;

    const filename = preview.name
      ? `${preview.name.toLowerCase().replace(/\s+/g, '-')}.html`
      : 'preview.html';

    const blob = new Blob([preview.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`Downloaded ${filename}`);
    downloadMenuOpen = false;
  }

  function downloadSpec() {
    if (!preview.spec) return;

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = preview.name
      ? `${preview.name.toLowerCase().replace(/\s+/g, '-')}-spec-${timestamp}.md`
      : `spec-${timestamp}.md`;

    const blob = new Blob([preview.spec], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`Downloaded ${filename}`);
    downloadMenuOpen = false;
  }

  function openInNewTab() {
    if (!preview.html) return;

    const blob = new Blob([preview.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');

    // Clean up after a delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleAiEdit() {
    if (!hasGeminiApiKey()) {
      if (onRequestApiKey) {
        onRequestApiKey(() => {
          showEditDialog = true;
        });
      } else {
        toast.error('Please set your Gemini API key first (Cmd+K > "Set Gemini API Key")');
      }
      return;
    }

    showEditDialog = true;
  }

  function handleEditComplete(newHtml: string) {
    // Preserve the spec when editing the HTML
    appPreviewStore.setPreview(newHtml, preview.name ?? undefined, preview.spec ?? undefined);
  }
</script>

<AiPreviewEditDialog
  bind:open={showEditDialog}
  currentHtml={preview.html ?? ''}
  onEditComplete={handleEditComplete}
  {onRequestApiKey}
/>

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
          onclick={handleAiEdit}
          title="AI Edit preview"
          class="cursor-pointer rounded p-1 text-purple-400 transition-colors hover:bg-purple-900/30 hover:text-purple-300"
        >
          <Sparkles class="h-4 w-4" />
        </button>

        <button
          onclick={refreshPreview}
          title="Refresh preview"
          class="cursor-pointer rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
        >
          <RefreshCw class="h-4 w-4" />
        </button>

        <!-- Copy dropdown -->
        <Popover.Root bind:open={copyMenuOpen}>
          <Popover.Trigger
            title="Copy"
            class="cursor-pointer rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
          >
            <Copy class="h-4 w-4" />
          </Popover.Trigger>
          <Popover.Content class="w-44 border-zinc-700 bg-zinc-900 p-1" align="end" side="bottom">
            <button
              onclick={copyHtml}
              class="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-700"
            >
              <FileCode class="h-4 w-4" />
              Copy HTML
            </button>
            {#if preview.spec}
              <button
                onclick={copySpec}
                class="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-700"
              >
                <FileText class="h-4 w-4" />
                Copy Spec
              </button>
            {/if}
          </Popover.Content>
        </Popover.Root>

        <!-- Download dropdown -->
        <Popover.Root bind:open={downloadMenuOpen}>
          <Popover.Trigger
            title="Download"
            class="cursor-pointer rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
          >
            <Download class="h-4 w-4" />
          </Popover.Trigger>
          <Popover.Content class="w-44 border-zinc-700 bg-zinc-900 p-1" align="end" side="bottom">
            <button
              onclick={downloadHtml}
              class="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-700"
            >
              <FileCode class="h-4 w-4" />
              Download HTML
            </button>
            {#if preview.spec}
              <button
                onclick={downloadSpec}
                class="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-700"
              >
                <FileText class="h-4 w-4" />
                Download Spec
              </button>
            {/if}
          </Popover.Content>
        </Popover.Root>

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
      <Code class="mb-3 h-10 w-10 text-zinc-600" />
      <p class="text-sm text-zinc-400">No preview yet</p>
      <p class="mt-1 text-xs text-zinc-500">Generate an app from your patch</p>
      {#if onOpenPatchToApp}
        <button
          onclick={onOpenPatchToApp}
          class="mt-4 flex cursor-pointer items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
        >
          <Sparkles class="h-4 w-4" />
          Patch to App
        </button>
      {/if}
    </div>
  {/if}
</div>
