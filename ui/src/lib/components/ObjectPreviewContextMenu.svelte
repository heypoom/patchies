<script lang="ts">
  import {
    CircleHelp,
    Code,
    Eye,
    EyeOff,
    Monitor,
    MonitorOff,
    Pin,
    PinOff,
    Play,
    Settings
  } from '@lucide/svelte/icons';
  import * as ContextMenu from './ui/context-menu';
  import type { SettingsSchema } from '$lib/settings';
  import type { ExtraMenuItem } from './ObjectPreviewOverflowMenu.svelte';

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
    onBgOutputToggle,
    onPlaybackToggle,
    onOpenHelp,
    extraMenuItems
  }: {
    onrun?: () => void;
    showBgOutputOption: boolean;
    nodeId?: string;
    isOutputOverride: boolean;
    showPauseButton: boolean;
    canPin: boolean;
    paused: boolean;
    onPreviewToggle?: () => void;
    previewVisible: boolean;
    settingsSchema?: SettingsSchema;
    showSettings: boolean;
    onSettingsToggle: () => void;
    /** Provided when code editor is NOT the primary button — adds an "Edit code" entry. */
    onCodeToggle?: () => void;
    onBgOutputToggle: () => void;
    onPlaybackToggle: () => void;
    onOpenHelp: () => void;
    extraMenuItems?: ExtraMenuItem[];
  } = $props();
</script>

<ContextMenu.Content>
  {#if onrun}
    <ContextMenu.Item onclick={onrun}>
      <Play class="mr-2 h-4 w-4" />
      Run
    </ContextMenu.Item>
  {/if}

  {#if onCodeToggle}
    <ContextMenu.Item onclick={onCodeToggle}>
      <Code class="mr-2 h-4 w-4" />
      Edit code
    </ContextMenu.Item>
  {/if}

  {#if extraMenuItems && extraMenuItems.length > 0}
    {#each extraMenuItems as item}
      <ContextMenu.Item onclick={item.onclick}>
        <item.icon class="mr-2 h-4 w-4 {item.variant === 'danger' ? 'text-red-400' : ''}" />
        <span class={item.variant === 'danger' ? 'text-red-400' : ''}>{item.label}</span>
      </ContextMenu.Item>
    {/each}
    <ContextMenu.Separator />
  {/if}

  {#if settingsSchema && settingsSchema.length > 0}
    <ContextMenu.Item onclick={onSettingsToggle}>
      <Settings class="mr-2 h-4 w-4" />
      {showSettings ? 'Hide settings' : 'Show settings'}
    </ContextMenu.Item>
  {/if}

  {#if showBgOutputOption && nodeId !== undefined}
    <ContextMenu.Item onclick={onBgOutputToggle}>
      {#if isOutputOverride}
        <MonitorOff class="mr-2 h-4 w-4 text-orange-400" />
        <span class="text-orange-400">Remove background output</span>
      {:else}
        <Monitor class="mr-2 h-4 w-4" />
        Output to background
      {/if}
    </ContextMenu.Item>
  {/if}

  {#if showPauseButton}
    <ContextMenu.Item onclick={onPlaybackToggle} disabled={!canPin && !paused}>
      {#if paused}
        <PinOff class="mr-2 h-4 w-4 text-red-400" />
        Unfreeze frame
      {:else}
        <Pin class="mr-2 h-4 w-4" />
        Freeze frame
      {/if}
    </ContextMenu.Item>
  {/if}

  {#if onPreviewToggle}
    <ContextMenu.Item onclick={onPreviewToggle}>
      {#if previewVisible}
        <EyeOff class="mr-2 h-4 w-4" />
        Hide preview
      {:else}
        <Eye class="mr-2 h-4 w-4" />
        Show preview
      {/if}
    </ContextMenu.Item>
  {/if}

  <ContextMenu.Separator />

  <ContextMenu.Item onclick={onOpenHelp}>
    <CircleHelp class="mr-2 h-4 w-4" />
    Help
  </ContextMenu.Item>
</ContextMenu.Content>
