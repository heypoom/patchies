<script lang="ts">
  import { Play, X } from '@lucide/svelte/icons';
  import { onDestroy, onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import * as Tooltip from './ui/tooltip';
  import { overlayEditorTransparency } from '../../stores/editor-layout-settings.store';
  import { isSidebarOpen } from '../../stores/ui.store';
  import { isFullscreenActive } from '$lib/canvas/SurfaceOverlay';

  let {
    onClose,
    onrun,
    codeEditor
  }: {
    onClose: () => void;
    onrun?: () => void;
    codeEditor: Snippet;
  } = $props();

  let panelBackground = $derived(`rgba(9, 9, 11, ${$overlayEditorTransparency})`);

  function handleKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !event.shiftKey) return;

    event.preventDefault();
    event.stopPropagation();
    onClose();
  }

  onMount(() => {
    isSidebarOpen.set(false);
    isFullscreenActive.set(true);
    window.addEventListener('keydown', handleKeydown, { capture: true });
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown, { capture: true });
    isFullscreenActive.set(false);
  });
</script>

<div
  class="detached-code-editor-overlay fixed inset-0 z-[60]"
  style:background-color={panelBackground}
>
  <div class="absolute top-6 right-6 z-10 flex gap-1">
    {#if onrun}
      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            class="cursor-pointer rounded bg-black/35 p-2 text-zinc-300 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100"
            onclick={onrun}
            aria-label="Run code"
          >
            <Play class="h-4 w-4" />
          </button>
        </Tooltip.Trigger>

        <Tooltip.Content>Run Code</Tooltip.Content>
      </Tooltip.Root>
    {/if}

    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          class="cursor-pointer rounded bg-black/35 p-2 text-zinc-300 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100"
          onclick={onClose}
          aria-label="Close expanded editor"
        >
          <X class="h-4 w-4" />
        </button>
      </Tooltip.Trigger>

      <Tooltip.Content>Close Expanded Editor (Shift+Esc)</Tooltip.Content>
    </Tooltip.Root>
  </div>

  <div class="h-full w-full">
    {@render codeEditor()}
  </div>
</div>

<style>
  :global(.detached-code-editor-overlay .code-editor-container) {
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
  }

  :global(.detached-code-editor-overlay .cm-editor) {
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    font-size: 28px !important;
  }

  :global(.detached-code-editor-overlay .cm-editor.cm-focused) {
    border-color: transparent !important;
    box-shadow: none !important;
  }

  :global(.detached-code-editor-overlay .cm-content) {
    max-width: none !important;
    max-height: none !important;
    padding: 48px !important;
    line-height: 1.55 !important;
  }

  :global(.detached-code-editor-overlay .cm-line) {
    padding: 0 8px !important;
  }

  :global(.detached-code-editor-overlay .cm-scroller) {
    padding: 8px 0 !important;
  }
</style>
