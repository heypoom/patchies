<script lang="ts">
  import {
    Loader2,
    Sparkles,
    ChevronDown,
    ChevronUp,
    Maximize2,
    Minus,
    X
  } from '@lucide/svelte/icons';
  import { toast } from 'svelte-sonner';
  import { editCode, hasGeminiApiKey } from '$lib/ai/patch-to-prompt';
  import { isMobile, isSidebarOpen } from '../../../stores/ui.store';

  let {
    open = $bindable(false),
    currentHtml,
    onEditComplete,
    onRequestApiKey
  }: {
    open: boolean;
    currentHtml: string;
    onEditComplete: (newHtml: string) => void;
    onRequestApiKey?: (onKeyReady: () => void) => void;
  } = $props();

  let editPrompt = $state('');
  let isEditing = $state(false);
  let thinkingLog = $state<string[]>([]);
  let isPromptExpanded = $state(false);
  let abortController: AbortController | null = $state(null);
  let isMinimized = $state(false);

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
    if (isEditing) return;
    open = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleEdit();
    }
  }

  async function doEdit() {
    if (!editPrompt.trim() || isEditing) return;

    isEditing = true;
    thinkingLog = [];
    abortController = new AbortController();
    handleMinimize();

    try {
      const newHtml = await editCode(currentHtml, editPrompt, {
        signal: abortController.signal,
        onThinking: (thought) => {
          thinkingLog = [...thinkingLog, thought];
        }
      });

      onEditComplete(newHtml);
      toast.success('Preview updated!');
      open = false;
    } catch (error) {
      if (error instanceof Error && error.message === 'Request cancelled') {
        toast.info('Edit cancelled');
      } else {
        console.error('Edit failed:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to edit preview');
      }
    } finally {
      isEditing = false;
      abortController = null;
    }
  }

  function handleEdit() {
    if (!hasGeminiApiKey()) {
      onRequestApiKey?.(() => doEdit());
      return;
    }

    doEdit();
  }

  function handleCancel() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  }

  // Reset state when dialog opens
  $effect(() => {
    if (open) {
      editPrompt = '';
      thinkingLog = [];
      isPromptExpanded = false;
      isMinimized = false;
    }
  });

  function handleClickOutside(event: MouseEvent) {
    if (isEditing) return;
    const target = event.target as HTMLElement;
    if (!target.closest('.ai-edit-dialog')) {
      open = false;
    }
  }

  // Handle escape key and click-outside globally when open
  $effect(() => {
    if (open) {
      const keyHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (isEditing) {
            handleMinimize();
          } else {
            open = false;
          }
        }
      };
      // Defer adding click listener to avoid catching the click that opened the dialog
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);
      document.addEventListener('keydown', keyHandler);
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('keydown', keyHandler);
      };
    }
  });
</script>

{#if open}
  <!-- Minimized indicator -->
  {#if isMinimized && isEditing && !($isSidebarOpen && $isMobile)}
    <button
      onclick={handleRestore}
      class="fixed top-4 right-4 z-50 flex max-w-72 cursor-pointer items-start gap-2 rounded-lg border border-purple-500 bg-purple-900/90 px-3 py-2 shadow-lg ring-2 ring-purple-500/50 transition-all hover:scale-105"
      title="Click to restore AI edit dialog"
    >
      <div class="min-w-0 flex-1 text-left">
        <div class="text-xs font-medium text-white">Editing preview...</div>
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
    class="ai-edit-dialog fixed top-1/2 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl {isMinimized
      ? 'hidden'
      : ''}"
    role="dialog"
    aria-modal="true"
  >
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-zinc-700 px-6 py-4">
      <div>
        <h2 class="flex items-center gap-2 text-lg font-semibold text-zinc-100">
          <Sparkles class="h-5 w-5 text-purple-400" />
          AI Edit Preview
        </h2>
        <p class="mt-1 text-sm text-zinc-400">
          Describe what you want to change in the generated preview.
        </p>
      </div>
      <div class="flex items-center gap-1">
        {#if isEditing}
          <button
            onclick={handleMinimize}
            class="cursor-pointer rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
            title="Minimize"
          >
            <Minus class="h-4 w-4" />
          </button>
        {:else}
          <button
            onclick={handleClose}
            class="cursor-pointer rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
            title="Close"
          >
            <X class="h-4 w-4" />
          </button>
        {/if}
      </div>
    </div>

    <!-- Content -->
    <div class="space-y-4 px-6 py-4">
      {#if isEditing}
        <!-- Collapsible prompt during editing -->
        <button
          onclick={() => (isPromptExpanded = !isPromptExpanded)}
          class="flex w-full cursor-pointer items-center gap-2 rounded border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-left text-xs text-zinc-400 transition-colors hover:bg-zinc-800"
        >
          {#if isPromptExpanded}
            <ChevronUp class="h-3 w-3" />
          {:else}
            <ChevronDown class="h-3 w-3" />
          {/if}
          <span class="flex-1 truncate font-mono">Edit Prompt</span>
        </button>

        {#if isPromptExpanded}
          <div
            class="rounded border border-zinc-700 bg-zinc-800/50 px-3 py-2 font-mono text-sm text-zinc-300"
          >
            {editPrompt}
          </div>
        {/if}

        <!-- Thinking logs -->
        {#if thinkingLog.length > 0}
          <div
            class="flex max-h-48 flex-col gap-2 overflow-y-auto rounded border border-zinc-700 bg-zinc-800/50 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-300"
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
        {:else}
          <div class="flex items-center justify-center py-4 text-xs text-zinc-500">
            <Loader2 class="mr-2 h-3 w-3 animate-spin" />
            Waiting for thoughts...
          </div>
        {/if}
      {:else}
        <!-- Normal textarea when not editing -->
        <textarea
          bind:value={editPrompt}
          onkeydown={handleKeydown}
          placeholder="e.g., 'Make the background gradient', 'Add a button to reset', 'Change the font to monospace'..."
          class="nodrag w-full resize-y rounded border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          rows="3"
        ></textarea>
      {/if}
    </div>

    <!-- Footer -->
    <div class="flex gap-2 border-t border-zinc-700 px-6 py-4">
      {#if isEditing}
        <button
          onclick={handleCancel}
          class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-600"
        >
          Cancel
        </button>
      {:else}
        <button
          onclick={handleClose}
          class="flex flex-1 cursor-pointer items-center justify-center rounded bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-600"
        >
          Close
        </button>

        <button
          onclick={handleEdit}
          disabled={!editPrompt.trim()}
          class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded bg-purple-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles class="h-4 w-4" />
          Apply Edit
        </button>
      {/if}
    </div>
  </div>
{/if}
