<script lang="ts">
  import { Check, ChevronsUpDown, PanelLeftOpen, Pin, PinOff, Play } from '@lucide/svelte/icons';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import * as Command from '$lib/components/ui/command';
  import * as Popover from '$lib/components/ui/popover';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import { useCodeSidebarTargetSelection } from '$lib/code-editor/use-code-sidebar-target.svelte';
  import {
    defaultEditorLayout,
    setDefaultEditorLayout
  } from '../../../stores/editor-layout-settings.store';

  const selection = useCodeSidebarTargetSelection();

  let targets = $derived(selection.targets);
  let target = $derived(selection.activeTarget);
  let pinnedTargetId = $derived(selection.pinnedTargetId);
  let targetPickerOpen = $state(false);
  let targetQuery = $state('');

  let filteredTargets = $derived(
    targets.filter((candidate) => {
      const query = targetQuery.trim().toLowerCase();

      return !query || `${candidate.label} ${candidate.nodeId}`.toLowerCase().includes(query);
    })
  );

  function useSidebarByDefault() {
    setDefaultEditorLayout('sidebar');
  }

  function selectTarget(targetId: string) {
    selection.selectTarget(targetId);
    targetPickerOpen = false;
    targetQuery = '';
  }
</script>

<div class="flex h-full min-h-0 flex-col">
  <div class="shrink-0 border-b border-zinc-800 bg-zinc-950 px-3 py-2">
    <div class="flex items-center gap-2">
      {#if target}
        <Popover.Root bind:open={targetPickerOpen}>
          <Popover.Trigger
            class="flex h-8 min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-left font-mono text-xs text-zinc-200 outline-none hover:border-zinc-600 focus-visible:border-orange-400 focus-visible:ring-2 focus-visible:ring-orange-400/20"
            aria-label="Select code target"
          >
            <span class="min-w-0 truncate">{target.label}</span>
            <ChevronsUpDown class="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          </Popover.Trigger>
          <Popover.Content class="w-[min(22rem,calc(100vw-2rem))] p-0" align="start" sideOffset={6}>
            <Command.Root shouldFilter={false}>
              <Command.Input placeholder="Search objects..." bind:value={targetQuery} />
              <Command.List class="max-h-64">
                <Command.Empty>No code-capable object found.</Command.Empty>
                <Command.Group>
                  {#each filteredTargets as candidate (candidate.nodeId)}
                    <Command.Item
                      value={`${candidate.label} ${candidate.nodeId}`}
                      onSelect={() => selectTarget(candidate.nodeId)}
                      class="cursor-pointer"
                    >
                      <Check
                        class={[
                          'h-3.5 w-3.5',
                          candidate.nodeId === target.nodeId ? 'opacity-100' : 'opacity-0'
                        ]}
                      />
                      <span class="min-w-0 truncate font-mono text-xs">{candidate.label}</span>
                    </Command.Item>
                  {/each}
                </Command.Group>
              </Command.List>
            </Command.Root>
          </Popover.Content>
        </Popover.Root>
      {:else}
        <div class="min-w-0">
          <div class="truncate text-sm font-medium text-zinc-200">Code</div>
        </div>
      {/if}

      <div class="flex shrink-0 items-center gap-1">
        {#if target?.onrun}
          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-orange-400/30 focus-visible:outline-none"
                onclick={() => target?.onrun?.()}
                aria-label="Run code"
              >
                <Play class="h-4 w-4" />
              </button>
            </Tooltip.Trigger>

            <Tooltip.Content>Run Code</Tooltip.Content>
          </Tooltip.Root>
        {/if}
        {#if target}
          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                class={[
                  'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-orange-400/30 focus-visible:outline-none',
                  pinnedTargetId
                    ? 'border-orange-500/50 bg-orange-500/15 text-orange-300 hover:bg-orange-500/25'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                ]}
                onclick={selection.togglePin}
                aria-label={pinnedTargetId ? 'Unpin code target' : 'Pin code target'}
                aria-pressed={Boolean(pinnedTargetId)}
              >
                {#if pinnedTargetId}<PinOff class="h-3.5 w-3.5" />{:else}<Pin
                    class="h-3.5 w-3.5"
                  />{/if}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content>{pinnedTargetId ? 'Unpin target' : 'Pin target'}</Tooltip.Content>
          </Tooltip.Root>
        {/if}
      </div>
    </div>
    {#if target}
      <p class="mt-1.5 truncate font-mono text-[11px] text-zinc-500">
        {pinnedTargetId ? 'Pinned' : 'Following canvas selection'}
      </p>
    {/if}
  </div>

  <div class="sidebar-code-editor min-h-0 flex-1 overflow-hidden">
    {#if target}
      <CodeEditor
        value={target.value}
        onchange={target.onchange ?? (() => {})}
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
            Select a code-capable object to edit it here.
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
