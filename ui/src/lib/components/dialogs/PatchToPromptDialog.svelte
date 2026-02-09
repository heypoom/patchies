<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import {
    Dices,
    Copy,
    Download,
    Pencil,
    Lock,
    Sparkles,
    Loader2,
    Code
  } from '@lucide/svelte/icons';
  import { toast } from 'svelte-sonner';
  import type { Node, Edge } from '@xyflow/svelte';
  import {
    cleanPatch,
    buildDirectTemplate,
    getRandomPrompt,
    refineSpec,
    generateCode,
    hasGeminiApiKey
  } from '$lib/ai/patch-to-prompt';
  import { appPreviewStore } from '../../../stores/app-preview.store';
  import { isSidebarOpen, sidebarView } from '../../../stores/ui.store';

  let {
    open = $bindable(false),
    nodes,
    edges,
    patchName,
    onRequestApiKey
  }: {
    open: boolean;
    nodes: Node[];
    edges: Edge[];
    patchName?: string;
    onRequestApiKey?: (onKeyReady: () => void) => void;
  } = $props();

  let steeringPrompt = $state('');
  let generatedPrompt = $state('');
  let isEditing = $state(false);
  let isRefining = $state(false);
  let isRefined = $state(false);
  let isGenerating = $state(false);

  // Generate prompt whenever inputs change
  $effect(() => {
    if (open && nodes.length > 0) {
      generatePrompt();
    }
  });

  function generatePrompt() {
    const cleanedPatch = cleanPatch(nodes, edges);
    generatedPrompt = buildDirectTemplate(cleanedPatch, {
      patchName,
      steeringPrompt
    });
  }

  function handleSteeringChange() {
    // Regenerate when steering prompt changes (if not editing)
    if (!isEditing) {
      generatePrompt();
    }
  }

  function rollDice() {
    steeringPrompt = getRandomPrompt();
    handleSteeringChange();
  }

  function toggleEdit() {
    isEditing = !isEditing;
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      toast.success('Copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy to clipboard');
      console.error('Copy failed:', error);
    }
  }

  function downloadFile() {
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = patchName
      ? `${patchName.toLowerCase().replace(/\s+/g, '-')}-spec-${timestamp}.md`
      : `patch-spec-${timestamp}.md`;

    const blob = new Blob([generatedPrompt], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`Downloaded ${filename}`);
  }

  async function doRefine() {
    if (isRefining) return;

    isRefining = true;

    try {
      const cleanedPatch = cleanPatch(nodes, edges);
      const refined = await refineSpec(cleanedPatch, {
        patchName,
        steeringPrompt
      });

      generatedPrompt = refined;
      isRefined = true;
      isEditing = false; // Lock editing after refinement
      toast.success('Specification refined with AI');
    } catch (error) {
      console.error('Refine failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to refine specification');
    } finally {
      isRefining = false;
    }
  }

  function handleRefine() {
    if (!hasGeminiApiKey()) {
      // Request API key, then refine when ready
      onRequestApiKey?.(() => doRefine());
      return;
    }

    doRefine();
  }

  async function doGenerate() {
    if (isGenerating) return;

    isGenerating = true;

    try {
      const html = await generateCode(generatedPrompt);

      // Store the preview
      appPreviewStore.setPreview(html, patchName ?? undefined);

      // Open sidebar to preview tab
      isSidebarOpen.set(true);
      sidebarView.set('preview');

      // Close dialog
      open = false;

      toast.success('App generated! Check the sidebar preview.');
    } catch (error) {
      console.error('Generate failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate app');
    } finally {
      isGenerating = false;
    }
  }

  function handleGenerate() {
    if (!hasGeminiApiKey()) {
      onRequestApiKey?.(() => doGenerate());
      return;
    }

    doGenerate();
  }

  // Reset state when dialog opens
  $effect(() => {
    if (open) {
      steeringPrompt = '';
      isEditing = false;
      isRefined = false;
    }
  });
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-h-[85vh] sm:max-w-3xl">
    <Dialog.Header>
      <Dialog.Title>Patch to Prompt</Dialog.Title>
      <Dialog.Description>
        Export your patch as an LLM-friendly specification. Copy this to AI coding assistants.
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4">
      <!-- Steering prompt input -->
      <div class="space-y-2">
        <label for="steering-prompt" class="block text-sm text-zinc-300">
          Describe what you want to build (optional):
        </label>

        <div class="flex gap-2">
          <input
            id="steering-prompt"
            type="text"
            bind:value={steeringPrompt}
            oninput={handleSteeringChange}
            placeholder="e.g., Simple HTML page with sliders, dark theme..."
            class="flex-1 rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />

          <button
            onclick={rollDice}
            title="Random example prompt"
            class="flex cursor-pointer items-center justify-center rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-zinc-300 transition-colors hover:bg-zinc-600"
          >
            <Dices class="h-4 w-4" />
          </button>
        </div>
      </div>

      <!-- Generated prompt preview -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-sm text-zinc-300">Generated Prompt</span>
            {#if isRefined}
              <span class="rounded bg-purple-600/20 px-1.5 py-0.5 text-xs text-purple-300">
                AI Refined
              </span>
            {/if}
          </div>

          <div class="flex items-center gap-1">
            <button
              onclick={handleRefine}
              disabled={isRefining || isGenerating}
              title="Refine with AI"
              class="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-purple-400 transition-colors hover:bg-purple-900/30 hover:text-purple-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {#if isRefining}
                <Loader2 class="h-3 w-3 animate-spin" />
                <span>Refining...</span>
              {:else}
                <Sparkles class="h-3 w-3" />
                <span>Refine</span>
              {/if}
            </button>

            <button
              onclick={handleGenerate}
              disabled={isGenerating || isRefining}
              title="Generate app from spec"
              class="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-emerald-400 transition-colors hover:bg-emerald-900/30 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {#if isGenerating}
                <Loader2 class="h-3 w-3 animate-spin" />
                <span>Generating...</span>
              {:else}
                <Code class="h-3 w-3" />
                <span>Generate</span>
              {/if}
            </button>

            <button
              onclick={toggleEdit}
              title={isEditing ? 'Lock editing' : 'Unlock editing'}
              class="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
            >
              {#if isEditing}
                <Lock class="h-3 w-3" />
                <span>Lock</span>
              {:else}
                <Pencil class="h-3 w-3" />
                <span>Edit</span>
              {/if}
            </button>
          </div>
        </div>

        <textarea
          bind:value={generatedPrompt}
          readonly={!isEditing}
          class="h-80 min-h-40 w-full resize-y rounded border border-zinc-600 bg-zinc-800 px-3 py-2 font-mono text-xs text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:outline-none {isEditing
            ? 'bg-zinc-750'
            : 'cursor-default'}"
        ></textarea>

        <div class="flex items-center justify-between text-xs text-zinc-500">
          <span>{generatedPrompt.length.toLocaleString()} characters</span>

          {#if isEditing}
            <span class="text-amber-400">Editing enabled - changes won't auto-regenerate</span>
          {/if}
        </div>
      </div>
    </div>

    <Dialog.Footer class="flex gap-2">
      <button
        onclick={() => (open = false)}
        class="flex flex-1 cursor-pointer items-center justify-center rounded bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-600"
      >
        Cancel
      </button>

      <button
        onclick={downloadFile}
        class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded bg-zinc-600 px-3 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-500"
      >
        <Download class="h-4 w-4" />
        Download
      </button>

      <button
        onclick={copyToClipboard}
        class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
      >
        <Copy class="h-4 w-4" />
        Copy
      </button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
