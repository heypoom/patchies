<script lang="ts">
  import { Check, ChevronsUpDown, Code2, Pin, PinOff, Play } from '@lucide/svelte/icons';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import * as Command from '$lib/components/ui/command';
  import * as Popover from '$lib/components/ui/popover';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import { useCodeSidebarTargetSelection } from '$lib/code-editor/use-code-sidebar-target.svelte';

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

  function selectTarget(targetId: string) {
    selection.selectTarget(targetId);
    targetPickerOpen = false;
    targetQuery = '';
  }
</script>

{#if !target}
  <div class="flex h-full flex-col items-center justify-center px-6 text-center">
    <div
      class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-500"
    >
      <Code2 class="h-5 w-5" />
    </div>
    <h2 class="text-sm font-medium text-zinc-300">No code objects</h2>
    <p class="mt-1 max-w-56 text-xs leading-5 text-zinc-500">
      Code-capable objects will appear here when they are added to this patch.
    </p>
  </div>
{:else}
  <div class="flex h-full min-h-0 flex-col">
    <div class="shrink-0 border-b border-zinc-800 bg-zinc-950 px-3 py-2">
      <div class="flex items-center gap-2">
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

        <div class="flex shrink-0 items-center gap-2">
          {#if target.onrun}
            <Tooltip.Root>
              <Tooltip.Trigger>
                <button
                  class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-orange-400/30 focus-visible:outline-none"
                  onclick={() => target.onrun?.()}
                  aria-label="Run code"
                >
                  <Play class="h-3.5 w-3.5" />
                </button>
              </Tooltip.Trigger>

              <Tooltip.Content>Run Code</Tooltip.Content>
            </Tooltip.Root>
          {/if}
          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                class={[
                  'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-orange-400/30 focus-visible:outline-none',
                  pinnedTargetId
                    ? 'border-orange-500/50 bg-orange-500/15 text-orange-300 hover:bg-orange-500/25'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
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
        </div>
      </div>

      <p class="mt-1.5 truncate font-mono text-[11px] text-zinc-500">
        {pinnedTargetId ? 'Pinned' : 'Following canvas selection'}
      </p>
    </div>

    <div class="sidebar-code-editor min-h-0 flex-1 overflow-hidden">
      {#key `${target.nodeId}:${target.dataKey}`}
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
      {/key}
    </div>
  </div>
{/if}

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
