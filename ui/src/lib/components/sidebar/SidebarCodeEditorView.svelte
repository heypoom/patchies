<script lang="ts">
  import { PanelLeftOpen, Play } from '@lucide/svelte/icons';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import type { CodeEditorTarget } from '../../../stores/code-editor-layout.store';
  import {
    defaultEditorLayout,
    setDefaultEditorLayout
  } from '../../../stores/editor-layout-settings.store';

  let {
    target,
    value = '',
    onchange,
    title,
    onrun
  }: {
    target?: CodeEditorTarget;
    value?: string;
    onchange?: (value: string) => void;
    title?: string;
    onrun?: (code?: string) => void;
  } = $props();

  function useSidebarByDefault() {
    setDefaultEditorLayout('sidebar');
  }
</script>

<div class="flex h-full min-h-0 flex-col">
  <div class="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-3 py-2">
    <div class="min-w-0">
      <div class="truncate text-sm font-medium text-zinc-200">{title ?? 'Code'}</div>
    </div>

    <div class="flex shrink-0 items-center gap-1">
      {#if onrun}
        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              class="cursor-pointer rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
              onclick={onrun}
              aria-label="Run code"
            >
              <Play class="h-4 w-4" />
            </button>
          </Tooltip.Trigger>

          <Tooltip.Content>Run Code</Tooltip.Content>
        </Tooltip.Root>
      {/if}
    </div>
  </div>

  <div class="sidebar-code-editor min-h-0 flex-1 overflow-hidden">
    {#if target}
      <CodeEditor
        {value}
        onchange={onchange ?? (() => {})}
        language={target.language}
        nodeType={target.nodeType}
        placeholder={target.placeholder ?? ''}
        class="nodrag nopan nowheel h-full w-full resize-none"
        onrun={target.onrun}
        nodeId={target.nodeId}
        dataKey={target.dataKey}
      />
    {:else}
      <div class="flex h-full items-center justify-center px-4 text-center">
        <div class="flex max-w-[220px] flex-col items-center gap-3">
          <div class="text-sm leading-5 text-zinc-500">
            Open editors here by default when using visual code nodes.
          </div>

          <button
            class="inline-flex cursor-pointer items-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            onclick={useSidebarByDefault}
            disabled={$defaultEditorLayout === 'sidebar'}
          >
            <PanelLeftOpen class="h-3.5 w-3.5" />

            {$defaultEditorLayout === 'sidebar' ? 'Sidebar Is Default' : 'Use Sidebar by Default'}
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  :global(.sidebar-code-editor .code-editor-container) {
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
  }

  :global(.sidebar-code-editor .cm-editor) {
    height: 100% !important;
    border: none !important;
    border-radius: 0 !important;
  }

  :global(.sidebar-code-editor .cm-editor.cm-focused) {
    border-color: transparent !important;
  }

  :global(.sidebar-code-editor .cm-scroller) {
    height: 100% !important;
  }
</style>
