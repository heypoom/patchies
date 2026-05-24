<script lang="ts">
  import * as ContextMenu from './ui/context-menu';
  import {
    getObjectPreviewMenuGroups,
    type ObjectPreviewMenuAction,
    type ObjectPreviewMenuProps
  } from './object-preview-menu-actions';

  let {
    onrun,
    showBgOutputOption,
    nodeId,
    isOutputOverride,
    showPauseButton,
    canPin,
    paused,
    onPreviewToggle,
    previewVisible,
    settingsSchema,
    showSettings,
    onSettingsToggle,
    onCodeToggle,
    onExpandToggle,
    isExpanded = false,
    onBgOutputToggle,
    onPlaybackToggle,
    onOpenHelp,
    extraMenuItems
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
      onOpenHelp,
      extraMenuItems
    })
  );

  function getVariantClass(action: ObjectPreviewMenuAction) {
    if (action.variant === 'danger') return 'text-red-400';
    if (action.variant === 'warning') return 'text-orange-400';
    return '';
  }
</script>

<ContextMenu.Content>
  {#each menuGroups as group, groupIndex (group.id)}
    {#if groupIndex > 0}
      <ContextMenu.Separator />
    {/if}

    {#each group.actions as action (action.id)}
      <ContextMenu.Item onclick={action.onclick} disabled={action.disabled}>
        <action.icon class="mr-2 h-4 w-4 {getVariantClass(action)}" />
        <span class={action.variant ? getVariantClass(action) : ''}>{action.label}</span>
      </ContextMenu.Item>
    {/each}
  {/each}
</ContextMenu.Content>
