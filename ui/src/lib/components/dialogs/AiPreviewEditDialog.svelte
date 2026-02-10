<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import { Loader2, Sparkles, ChevronDown, ChevronUp } from '@lucide/svelte/icons';
  import { toast } from 'svelte-sonner';
  import { editCode, hasGeminiApiKey } from '$lib/ai/patch-to-prompt';

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

  async function doEdit() {
    if (!editPrompt.trim() || isEditing) return;

    isEditing = true;
    thinkingLog = [];
    abortController = new AbortController();

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

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleEdit();
    }
  }

  // Reset state when dialog opens
  $effect(() => {
    if (open) {
      editPrompt = '';
      thinkingLog = [];
      isPromptExpanded = false;
    }
  });
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-lg">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <Sparkles class="h-5 w-5 text-purple-400" />
        AI Edit Preview
      </Dialog.Title>
      <Dialog.Description>
        Describe what you want to change in the generated preview.
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4">
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

    <Dialog.Footer class="flex gap-2">
      {#if isEditing}
        <button
          onclick={handleCancel}
          class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-600"
        >
          Cancel
        </button>
      {:else}
        <button
          onclick={() => (open = false)}
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
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
