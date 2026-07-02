<script lang="ts">
  import { Ellipsis } from '@lucide/svelte/icons';
  import * as Popover from './ui/popover';
  import Separator from './ui/separator/separator.svelte';
  import {
    getObjectPreviewMenuGroups,
    type ObjectPreviewMenuAction,
    type ObjectPreviewMenuProps
  } from './object-preview-menu-actions';

  let {
    onrun,
    settingsSchema,
    showSettings = false,
    showBgOutputOption = false,
    nodeId,
    isOutputOverride = false,
    showPauseButton = false,
    paused = false,
    canPin = false,
    onPreviewToggle,
    previewVisible = true,
    onSettingsToggle,
    onCodeToggle,
    onExpandToggle,
    isExpanded = false,
    onBgOutputToggle,
    onPlaybackToggle,
    onSaveAsPreset,
    onOpenHelp,
    extraMenuItems,
    displayExtraMenuItems
  }: ObjectPreviewMenuProps = $props();

  const menuGroups = $derived(
    getObjectPreviewMenuGroups({
      onrun,
      settingsSchema,
      showSettings,
      showBgOutputOption,
      nodeId,
      isOutputOverride,
      showPauseButton,
      paused,
      canPin,
      onPreviewToggle,
      previewVisible,
      onSettingsToggle,
      onCodeToggle,
      onExpandToggle,
      isExpanded,
      onBgOutputToggle,
      onPlaybackToggle,
      onSaveAsPreset,
      onOpenHelp,
      extraMenuItems,
      displayExtraMenuItems
    })
  );

  function getVariantClass(action: ObjectPreviewMenuAction) {
    if (action.variant === 'danger') return 'text-red-400';
    if (action.variant === 'warning') return 'text-orange-400';

    return 'text-zinc-300';
  }
</script>

<Popover.Root>
  <Popover.Trigger>
    <button class="node-floating-button">
      <Ellipsis class="h-4 w-4 text-zinc-300" />
    </button>
  </Popover.Trigger>

  <Popover.Content class="flex w-auto flex-col p-1" align="end" sideOffset={4}>
    {#each menuGroups as group, groupIndex (group.id)}
      {#if groupIndex > 0}
        <Separator />
      {/if}

      {#each group.actions as action (action.id)}
        <Popover.Close class="contents">
          <button
            class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            onclick={action.onclick}
            disabled={action.disabled}
          >
            <action.icon class="h-4 w-4 {getVariantClass(action)}" />

            <span class={action.variant ? getVariantClass(action) : ''}>{action.label}</span>
          </button>
        </Popover.Close>
      {/each}
    {/each}
  </Popover.Content>
</Popover.Root>
