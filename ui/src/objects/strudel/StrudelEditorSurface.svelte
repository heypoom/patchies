<script lang="ts">
  import { Play, Square, X } from '@lucide/svelte/icons';
  import type { Snippet } from 'svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { portal } from '$lib/dom/portal';
  import { overlayEditorTransparency } from '../../stores/editor-layout-settings.store';
  import { editorFullscreenTextBackgroundOpacity } from '../../stores/editor.store';

  let {
    isDetached,
    muted,
    isInitialized,
    syncTransport,
    isPlaying,
    containerStyle = '',
    dismissShortcutLabel,
    evaluate,
    stop,
    closeExpandedEditor,
    controls,
    children
  }: {
    isDetached: boolean;
    muted: boolean;
    isInitialized: boolean;
    syncTransport: boolean;
    isPlaying: boolean;
    containerStyle?: string;
    dismissShortcutLabel: string;
    evaluate: () => void;
    stop: () => void;
    closeExpandedEditor: () => void;
    controls: Snippet;
    children: Snippet;
  } = $props();

  const portalTarget = $derived(isDetached ? document.body : null);
  const detachedBackground = $derived(`rgba(9, 9, 11, ${$overlayEditorTransparency})`);
  const detachedTextBackground = $derived(
    `rgba(9, 9, 11, ${$editorFullscreenTextBackgroundOpacity / 100})`
  );
</script>

<div
  use:portal={portalTarget}
  class={[
    'nodrag nopan transition-opacity',
    isDetached
      ? 'strudel-detached-editor fixed inset-0 z-[60] flex items-stretch justify-stretch'
      : 'h-full w-full',
    muted ? 'opacity-40' : 'opacity-100'
  ]}
  style={isDetached ? `background-color:${detachedBackground};${containerStyle ?? ''}` : undefined}
>
  {#if isDetached}
    <div class="detached-editor-actions absolute z-10 flex gap-1">
      {#if isInitialized && !syncTransport}
        <Tooltip.Root>
          <Tooltip.Trigger
            class="cursor-pointer rounded bg-black/35 p-2 text-zinc-300 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100"
            onclick={isPlaying ? stop : evaluate}
            aria-label={isPlaying ? 'Stop Strudel' : 'Run Strudel'}
          >
            {#if isPlaying}<Square class="h-4 w-4" />{:else}<Play class="h-4 w-4" />{/if}
          </Tooltip.Trigger>
          <Tooltip.Content>{isPlaying ? 'Stop' : 'Run Strudel'}</Tooltip.Content>
        </Tooltip.Root>
      {/if}

      {@render controls()}

      <Tooltip.Root>
        <Tooltip.Trigger
          class="cursor-pointer rounded bg-black/35 p-2 text-zinc-300 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100"
          onclick={closeExpandedEditor}
          aria-label="Close expanded Strudel editor"
        >
          <X class="h-4 w-4" />
        </Tooltip.Trigger>
        <Tooltip.Content>Close Expanded Editor ({dismissShortcutLabel})</Tooltip.Content>
      </Tooltip.Root>
    </div>
  {/if}

  <div
    class={[
      'strudel-editor-shell nodrag nowheel h-full w-full overflow-hidden',
      !isDetached && 'p-2'
    ]}
    style:--fullscreen-text-background={isDetached ? detachedTextBackground : undefined}
  >
    {@render children()}
  </div>
</div>

<style>
  :global(.strudel-editor-shell .cm-editor) {
    height: 100%;
  }

  :global(.strudel-editor-shell .cm-content) {
    max-width: none !important;
  }

  :global(.strudel-editor-shell .cm-gutters) {
    display: none !important;
  }

  :global(.strudel-detached-editor .strudel-editor-shell .cm-editor) {
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }

  :global(.strudel-detached-editor .strudel-editor-shell .cm-focused),
  :global(.strudel-detached-editor .strudel-editor-shell *:focus) {
    outline: none !important;
  }

  :global(.strudel-detached-editor .strudel-editor-shell .cm-content) {
    padding: 48px !important;
    line-height: 1.55 !important;
  }

  :global(.strudel-detached-editor .strudel-editor-shell .cm-line) {
    width: fit-content;
    padding: 0 8px !important;
    background: var(--fullscreen-text-background);
  }

  :global(.strudel-detached-editor .strudel-editor-shell .cm-scroller) {
    padding: 8px 0 !important;
  }

  .detached-editor-actions {
    top: calc(env(safe-area-inset-top, 0px) + 1.5rem);
    right: calc(env(safe-area-inset-right, 0px) + 1.5rem);
  }
</style>
