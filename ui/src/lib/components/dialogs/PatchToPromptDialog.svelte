<script lang="ts">
  import * as Popover from '$lib/components/ui/popover';
  import {
    Dices,
    Copy,
    Download,
    Pencil,
    Lock,
    Sparkles,
    Loader2,
    Code,
    ChevronDown,
    ChevronUp,
    Check,
    Square,
    Maximize2,
    Minus,
    X
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
  import { isSidebarOpen, sidebarView, isMobile } from '../../../stores/ui.store';

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
  let thinkingLog = $state<string[]>([]);
  let isPromptCollapsed = $state(false);
  let isThinkingCollapsed = $state(false);
  let refineFirst = $state(false);
  let copyMenuOpen = $state(false);
  let isMinimized = $state(false);

  const isProcessing = $derived(isRefining || isGenerating);
  const thinkingText = $derived(
    thinkingLog.length > 0 ? thinkingLog[thinkingLog.length - 1] : null
  );

  function handleMinimize() {
    isMinimized = true;
  }

  function handleRestore() {
    isMinimized = false;
  }

  function handleClose() {
    if (isProcessing) return;
    open = false;
  }

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

  async function doCopy() {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      toast.success('Copied to clipboard!');
      copyMenuOpen = false;
    } catch (error) {
      toast.error('Failed to copy to clipboard');
      console.error('Copy failed:', error);
    }
  }

  async function handleCopy() {
    // Close popover immediately to prevent it from detaching when dialog minimizes
    copyMenuOpen = false;

    if (refineFirst && !isRefined) {
      // Need to refine first
      if (!hasGeminiApiKey()) {
        onRequestApiKey?.(() => refineAndThen(doCopy));
        return;
      }
      await refineAndThen(doCopy);
    } else {
      await doCopy();
    }
  }

  async function refineAndThen(callback: () => void | Promise<void>) {
    await doRefine();
    await callback();

    // Restore dialog after refine + copy/download completes (but not if callback closed it)
    if (open) {
      handleRestore();
    }
  }

  function doDownload() {
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
    copyMenuOpen = false;
  }

  async function handleDownload() {
    // Close popover immediately to prevent it from detaching when dialog minimizes
    copyMenuOpen = false;

    if (refineFirst && !isRefined) {
      if (!hasGeminiApiKey()) {
        onRequestApiKey?.(() => refineAndThen(doDownload));
        return;
      }
      await refineAndThen(doDownload);
    } else {
      doDownload();
    }
  }

  async function doRefine() {
    if (isRefining) return;

    isRefining = true;
    thinkingLog = [];
    handleMinimize();

    try {
      const cleanedPatch = cleanPatch(nodes, edges);
      const refined = await refineSpec(cleanedPatch, {
        patchName,
        steeringPrompt,
        onThinking: (thought) => {
          thinkingLog = [...thinkingLog, thought];
        }
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
    thinkingLog = [];
    handleMinimize();

    try {
      const html = await generateCode(generatedPrompt, {
        onThinking: (thought) => {
          thinkingLog = [...thinkingLog, thought];
        }
      });

      // Store the preview along with the spec used to generate it
      appPreviewStore.setPreview(html, patchName ?? undefined, generatedPrompt);

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

  async function handleGenerate() {
    if (!hasGeminiApiKey()) {
      onRequestApiKey?.(() => executeGenerate());
      return;
    }

    await executeGenerate();
  }

  async function executeGenerate() {
    if (refineFirst && !isRefined) {
      await refineAndThen(doGenerate);
    } else {
      await doGenerate();
    }
  }

  // Reset state when dialog opens
  $effect(() => {
    if (open) {
      steeringPrompt = '';
      isEditing = false;
      isRefined = false;
      thinkingLog = [];
      isPromptCollapsed = false;
      isThinkingCollapsed = false;
      refineFirst = false;
      copyMenuOpen = false;
      isMinimized = false;
    }
  });

  // Track previous processing state to detect completion
  let wasProcessing = $state(false);

  // Auto-collapse/expand sections based on processing state
  $effect(() => {
    if (isProcessing && !wasProcessing) {
      // Processing started: collapse prompt, show thinking
      isPromptCollapsed = true;
      isThinkingCollapsed = false;
    } else if (!isProcessing && wasProcessing) {
      // Processing finished: collapse thinking, show prompt
      isThinkingCollapsed = true;
      isPromptCollapsed = false;
    }

    wasProcessing = isProcessing;
  });

  // Handle escape key globally when open
  $effect(() => {
    if (open) {
      const keyHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (isProcessing) {
            handleMinimize();
          } else {
            open = false;
          }
        }
      };
      document.addEventListener('keydown', keyHandler);
      return () => {
        document.removeEventListener('keydown', keyHandler);
      };
    }
  });
</script>

{#if open}
  <!-- Minimized indicator -->
  {#if isMinimized && isProcessing && !($isSidebarOpen && $isMobile)}
    <button
      onclick={handleRestore}
      class="fixed top-4 right-4 z-50 flex max-w-72 cursor-pointer items-start gap-2 rounded-lg border border-emerald-500 bg-emerald-900/90 px-3 py-2 shadow-lg ring-2 ring-emerald-500/50 transition-all hover:scale-105"
      title="Click to restore Patch to App dialog"
    >
      <div class="min-w-0 flex-1 text-left">
        <div class="text-xs font-medium text-white">
          {#if isRefining}
            Refining spec...
          {:else}
            Generating app...
          {/if}
        </div>
        {#if thinkingText}
          <div
            class="mt-1 line-clamp-2 text-left font-mono text-[8px] leading-tight text-white/60 italic"
          >
            {thinkingText}
          </div>
        {/if}
      </div>
      <Maximize2 class="mt-0.5 h-3 w-3 shrink-0 text-white/70" />
    </button>
  {/if}

  <!-- Backdrop overlay -->
  {#if !isMinimized}
    <div class="fixed inset-0 z-40 bg-black/50" onclick={handleClose} role="presentation"></div>
  {/if}

  <!-- Dialog -->
  <div
    class="patch-to-app-dialog fixed inset-0 z-50 flex max-h-full flex-col bg-zinc-900 shadow-2xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[85vh] sm:w-full sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border sm:border-zinc-700 {isMinimized
      ? 'hidden'
      : ''}"
    role="dialog"
    aria-modal="true"
  >
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-zinc-700 px-6 py-4">
      <div>
        <h2 class="text-lg font-semibold text-zinc-100">Patch to App</h2>
        <p class="mt-1 text-sm text-zinc-400">
          Generate an app from your patch, or export as an LLM-friendly specification.
        </p>
      </div>
      <div class="flex items-center gap-1">
        {#if isProcessing}
          <button
            onclick={handleMinimize}
            class="cursor-pointer rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
            title="Minimize"
          >
            <Minus class="h-4 w-4" />
          </button>
        {/if}
        <button
          onclick={handleClose}
          disabled={isProcessing}
          class="cursor-pointer rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          title="Close"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </div>

    <!-- Content (scrollable) -->
    <div class="flex-1 space-y-4 overflow-y-auto px-6 py-4">
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

      <!-- Generated prompt preview (collapsible) -->
      <div class="space-y-2">
        <!-- Header row with collapse toggle -->
        <div class="flex items-center justify-between">
          <button
            onclick={() => (isPromptCollapsed = !isPromptCollapsed)}
            class="flex cursor-pointer items-center gap-2"
          >
            {#if isPromptCollapsed}
              <ChevronDown class="h-4 w-4 text-zinc-400" />
            {:else}
              <ChevronUp class="h-4 w-4 text-zinc-400" />
            {/if}
            <span class="text-sm text-zinc-300">Generated Prompt</span>
            {#if isRefined}
              <span class="rounded bg-purple-600/20 px-1.5 py-0.5 text-xs text-purple-300">
                AI Refined
              </span>
            {/if}
            <span class="text-xs text-zinc-500">
              ({generatedPrompt.length.toLocaleString()} chars)
            </span>
          </button>

          <button
            onclick={toggleEdit}
            disabled={isPromptCollapsed || isProcessing}
            title={isEditing ? 'Lock editing' : 'Edit spec'}
            class="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
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

        <!-- Collapsible content -->
        {#if !isPromptCollapsed}
          <textarea
            bind:value={generatedPrompt}
            readonly={!isEditing}
            class="h-64 min-h-32 w-full resize-y rounded border border-zinc-600 bg-zinc-800 px-3 py-2 font-mono text-xs text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:outline-none {isEditing
              ? 'bg-zinc-750'
              : 'cursor-default'}"
          ></textarea>

          {#if isEditing}
            <div class="text-xs text-amber-400">
              Editing enabled - changes won't auto-regenerate
            </div>
          {/if}
        {/if}
      </div>

      <!-- Thinking logs (shown during AI processing, collapsible) -->
      {#if isProcessing || thinkingLog.length > 0}
        <div class="space-y-2">
          <!-- Header with collapse toggle -->
          <button
            onclick={() => (isThinkingCollapsed = !isThinkingCollapsed)}
            class="flex w-full cursor-pointer items-center gap-2 text-sm"
          >
            {#if isThinkingCollapsed}
              <ChevronDown class="h-4 w-4 text-zinc-400" />
            {:else}
              <ChevronUp class="h-4 w-4 text-zinc-400" />
            {/if}

            {#if isProcessing}
              <Loader2 class="h-4 w-4 animate-spin text-purple-400" />
              <span class="text-zinc-300">
                {#if isRefining}
                  Refining specification...
                {:else}
                  Generating app...
                {/if}
              </span>
            {:else}
              <span class="text-zinc-400">Thinking Log</span>
            {/if}

            <span class="text-xs text-zinc-500">
              ({thinkingLog.length}
              {thinkingLog.length === 1 ? 'thought' : 'thoughts'})
            </span>
          </button>

          <!-- Collapsible content -->
          {#if !isThinkingCollapsed}
            {#if thinkingLog.length > 0}
              <div
                class="flex max-h-40 flex-col gap-2 overflow-y-auto rounded border border-zinc-700 bg-zinc-800/50 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-300"
              >
                {#each thinkingLog as thought, i}
                  <div
                    class="border-l-2 border-zinc-600 pl-2 {i === thinkingLog.length - 1
                      ? 'text-zinc-200'
                      : 'text-zinc-500'}"
                  >
                    {thought}
                  </div>
                {/each}
              </div>
            {:else if isProcessing}
              <div
                class="flex items-center justify-center rounded border border-zinc-700 bg-zinc-800/50 py-3 text-xs text-zinc-500"
              >
                Waiting for thoughts...
              </div>
            {/if}
          {/if}
        </div>
      {/if}
    </div>

    <!-- Refine checkbox -->
    <div class="px-6 pb-4">
      <button
        onclick={() => (refineFirst = !refineFirst)}
        disabled={isRefined || isProcessing}
        class="flex cursor-pointer items-center gap-2 text-sm text-zinc-300 transition-colors hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {#if refineFirst}
          <div
            class="flex h-4 w-4 items-center justify-center rounded border border-purple-500 bg-purple-600"
          >
            <Check class="h-3 w-3 text-white" />
          </div>
        {:else}
          <Square class="h-4 w-4 text-zinc-500" />
        {/if}

        <span>
          <Sparkles class="mr-1 mb-[4px] inline h-3 w-3 text-purple-400" />

          Refine spec with AI
        </span>

        {#if isRefined}
          <span class="text-xs text-purple-400">(refined)</span>
        {:else}
          <span class="text-xs text-zinc-500">(slower but better results)</span>
        {/if}
      </button>
    </div>

    <!-- Footer -->
    <div class="flex gap-2 border-t border-zinc-700 px-6 py-4">
      <!-- Copy with dropdown for Download -->
      <Popover.Root bind:open={copyMenuOpen}>
        <Popover.Trigger
          disabled={isProcessing}
          class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Copy class="h-4 w-4" />
          Copy Spec
          <ChevronDown class="h-3 w-3" />
        </Popover.Trigger>
        <Popover.Content class="w-48 border-zinc-700 bg-zinc-900 p-1" align="start" side="top">
          <button
            onclick={handleCopy}
            class="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-700"
          >
            <Copy class="h-4 w-4" />
            Copy to clipboard
          </button>
          <button
            onclick={handleDownload}
            class="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-700"
          >
            <Download class="h-4 w-4" />
            Download as .md
          </button>
        </Popover.Content>
      </Popover.Root>

      <!-- Generate App -->
      <button
        onclick={handleGenerate}
        disabled={isProcessing}
        class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {#if isProcessing}
          <Loader2 class="h-4 w-4 animate-spin" />
          {#if isRefining}
            Refining...
          {:else}
            Generating...
          {/if}
        {:else}
          <Code class="h-4 w-4" />
          Generate App
        {/if}
      </button>
    </div>
  </div>
{/if}
