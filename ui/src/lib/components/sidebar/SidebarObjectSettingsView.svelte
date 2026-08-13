<script lang="ts">
  import {
    Check,
    ChevronsUpDown,
    Pin,
    PinOff,
    RotateCcw,
    SlidersHorizontal
  } from '@lucide/svelte/icons';
  import ObjectSettings from '$lib/components/settings/ObjectSettings.svelte';
  import * as Command from '$lib/components/ui/command';
  import * as Popover from '$lib/components/ui/popover';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { selectedNodeInfo } from '../../../stores/ui.store';
  import {
    requestSettingsSidebarTargetId,
    settingsSidebarTargets
  } from '../../../stores/settings-sidebar.store';

  let { class: className = '' }: { class?: string } = $props();

  let activeTargetId = $state<string | null>(null);
  let pinnedTargetId = $state<string | null>(null);
  let lastSelectedNodeId = $state<string | null>(null);
  let targetPickerOpen = $state(false);
  let targetQuery = $state('');

  let targets = $derived(
    [...$settingsSidebarTargets.values()].sort((a, b) => a.label.localeCompare(b.label))
  );
  let activeTarget = $derived(
    activeTargetId ? (targets.find((target) => target.id === activeTargetId) ?? null) : null
  );
  let filteredTargets = $derived(
    targets.filter((target) => {
      const query = targetQuery.trim().toLowerCase();
      return !query || `${target.label} ${target.id}`.toLowerCase().includes(query);
    })
  );

  $effect(() => {
    const requestedTargetId = $requestSettingsSidebarTargetId;
    const requestedTarget = requestedTargetId
      ? targets.find((target) => target.id === requestedTargetId)
      : undefined;

    if (requestedTarget) {
      activeTargetId = requestedTarget.id;
      requestSettingsSidebarTargetId.set(null);
      return;
    }

    const pinnedTarget = pinnedTargetId
      ? targets.find((target) => target.id === pinnedTargetId)
      : undefined;

    if (pinnedTarget) {
      activeTargetId = pinnedTarget.id;
      return;
    }

    if (pinnedTargetId) pinnedTargetId = null;

    const selectedTarget = $selectedNodeInfo
      ? targets.find((target) => target.id === $selectedNodeInfo?.id)
      : undefined;

    const selectedNodeId = $selectedNodeInfo?.id ?? null;
    if (selectedTarget && selectedNodeId !== lastSelectedNodeId) {
      activeTargetId = selectedTarget.id;
    } else if (!activeTargetId || !targets.some((target) => target.id === activeTargetId)) {
      activeTargetId = targets[0]?.id ?? null;
    }

    lastSelectedNodeId = selectedNodeId;
  });

  function selectTarget(targetId: string) {
    activeTargetId = targetId;
    targetPickerOpen = false;
    targetQuery = '';
  }

  function togglePin() {
    pinnedTargetId = pinnedTargetId ? null : activeTargetId;
  }

  function settingsValueEquals(left: unknown, right: unknown): boolean {
    if (Array.isArray(left) && Array.isArray(right)) {
      return (
        left.length === right.length &&
        left.every((value, index) => settingsValueEquals(value, right[index]))
      );
    }

    return left === right;
  }

  function hasDirtySettings(): boolean {
    if (!activeTarget) return false;

    return activeTarget.schema.some((field) => {
      if (!('default' in field) || field.default === undefined) return false;

      const storedValue = activeTarget.values[field.key];
      const value = storedValue !== undefined ? storedValue : field.default;
      return !settingsValueEquals(value, field.default);
    });
  }

  let hasDirtySettingsValue = $derived(hasDirtySettings());
</script>

{#if targets.length === 0}
  <div class={['flex h-full flex-col items-center justify-center px-6 text-center', className]}>
    <div
      class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-500"
    >
      <SlidersHorizontal class="h-5 w-5" />
    </div>
    <h2 class="text-sm font-medium text-zinc-300">No object settings</h2>
    <p class="mt-1 max-w-56 text-xs leading-5 text-zinc-500">
      Settings-capable objects will appear here when they are added to this patch.
    </p>
  </div>
{:else if activeTarget}
  <div class={['flex min-h-full flex-col', className]}>
    <div class="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950 px-5 py-4">
      <div class="flex items-center gap-2">
        <Popover.Root bind:open={targetPickerOpen}>
          <Popover.Trigger
            class="flex h-8 min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-left font-mono text-xs text-zinc-200 outline-none hover:border-zinc-600 focus-visible:border-orange-400 focus-visible:ring-2 focus-visible:ring-orange-400/20"
            aria-label="Select object settings target"
          >
            <span class="min-w-0 truncate">{activeTarget.label}</span>
            <ChevronsUpDown class="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          </Popover.Trigger>
          <Popover.Content class="w-[min(22rem,calc(100vw-2rem))] p-0" align="start" sideOffset={6}>
            <Command.Root shouldFilter={false}>
              <Command.Input placeholder="Search objects..." bind:value={targetQuery} />
              <Command.List class="max-h-64">
                <Command.Empty>No settings-capable object found.</Command.Empty>
                <Command.Group>
                  {#each filteredTargets as target (target.id)}
                    <Command.Item
                      value={`${target.label} ${target.id}`}
                      onSelect={() => selectTarget(target.id)}
                      class="cursor-pointer"
                    >
                      <Check
                        class={[
                          'h-3.5 w-3.5',
                          target.id === activeTarget.id ? 'opacity-100' : 'opacity-0'
                        ]}
                      />
                      <span class="min-w-0 truncate font-mono text-xs">{target.label}</span>
                    </Command.Item>
                  {/each}
                </Command.Group>
              </Command.List>
            </Command.Root>
          </Popover.Content>
        </Popover.Root>
        {#if hasDirtySettingsValue}
          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                class="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-orange-400/30 focus-visible:outline-none"
                onclick={activeTarget.onRevertAll}
                aria-label="Revert all settings to defaults"
              >
                <RotateCcw class="h-3.5 w-3.5" />
                <span class="settings-revert-label">Revert</span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content>Revert all to defaults</Tooltip.Content>
          </Tooltip.Root>
        {/if}
        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              class={[
                'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-orange-400/30 focus-visible:outline-none',
                pinnedTargetId
                  ? 'border-orange-500/50 bg-orange-500/15 text-orange-300 hover:bg-orange-500/25'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
              ]}
              onclick={togglePin}
              aria-label={pinnedTargetId ? 'Unpin settings target' : 'Pin settings target'}
              aria-pressed={Boolean(pinnedTargetId)}
            >
              {#if pinnedTargetId}
                <PinOff class="h-4 w-4" />
              {:else}
                <Pin class="h-4 w-4" />
              {/if}
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content>{pinnedTargetId ? 'Unpin target' : 'Pin target'}</Tooltip.Content>
        </Tooltip.Root>
      </div>
      <p class="mt-2 truncate font-mono text-[11px] text-zinc-500">
        {pinnedTargetId ? 'Pinned' : 'Following canvas selection'}
      </p>
    </div>

    <div class="min-h-0 flex-1 px-5 py-5">
      {#key activeTarget.id}
        <ObjectSettings
          nodeId={activeTarget.id}
          schema={activeTarget.schema}
          values={activeTarget.values}
          onValueChange={activeTarget.onValueChange}
          onRevertAll={activeTarget.onRevertAll}
          onClose={() => {}}
          showCloseButton={false}
          showRevertButton={false}
          variant="sidebar"
        />
      {/key}
    </div>
  </div>
{/if}

<style>
  @container (max-width: 350px) {
    .settings-revert-label {
      display: none;
    }
  }
</style>
