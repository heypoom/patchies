<script lang="ts">
  import {
    CircleHelp,
    Eye,
    EyeOff,
    Ellipsis,
    Monitor,
    MonitorOff,
    Pin,
    PinOff,
    Play,
    Settings
  } from '@lucide/svelte/icons';
  import * as Popover from './ui/popover';
  import type { SettingsSchema } from '$lib/settings';

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
    onBgOutputToggle,
    onPlaybackToggle,
    onOpenHelp
  }: {
    onrun?: () => void;
    settingsSchema?: SettingsSchema;
    showSettings?: boolean;
    showBgOutputOption?: boolean;
    nodeId?: string;
    isOutputOverride?: boolean;
    showPauseButton?: boolean;
    paused?: boolean;
    canPin?: boolean;
    onPreviewToggle?: () => void;
    previewVisible?: boolean;
    onSettingsToggle?: () => void;
    onBgOutputToggle?: () => void;
    onPlaybackToggle?: () => void;
    onOpenHelp: () => void;
  } = $props();
</script>

<Popover.Root>
  <Popover.Trigger>
    <button
      class="cursor-pointer rounded p-1 transition-opacity hover:bg-zinc-700 sm:opacity-0 sm:group-hover:opacity-100"
    >
      <Ellipsis class="h-4 w-4 text-zinc-300" />
    </button>
  </Popover.Trigger>

  <Popover.Content class="flex w-auto flex-col p-1" align="end" sideOffset={4}>
    {#if onrun}
      <Popover.Close class="contents">
        <button
          class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-zinc-700"
          onclick={onrun}
        >
          <Play class="h-4 w-4 text-zinc-300" />
          <span>Run</span>
        </button>
      </Popover.Close>
    {/if}

    {#if settingsSchema && settingsSchema.length > 0}
      <Popover.Close class="contents">
        <button
          class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-zinc-700"
          onclick={onSettingsToggle}
        >
          <Settings class="h-4 w-4 text-zinc-300" />
          <span>{showSettings ? 'Hide settings' : 'Show settings'}</span>
        </button>
      </Popover.Close>
    {/if}

    {#if showBgOutputOption && nodeId !== undefined}
      <Popover.Close class="contents">
        <button
          class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-zinc-700"
          onclick={onBgOutputToggle}
        >
          {#if isOutputOverride}
            <MonitorOff class="h-4 w-4 text-orange-400" />
            <span>Remove background output</span>
          {:else}
            <Monitor class="h-4 w-4 text-zinc-300" />
            <span>Output to background</span>
          {/if}
        </button>
      </Popover.Close>
    {/if}

    {#if showPauseButton}
      <Popover.Close class="contents">
        <button
          class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          onclick={onPlaybackToggle}
          disabled={!canPin && !paused}
        >
          {#if paused}
            <PinOff class="h-4 w-4 text-red-400" />
            <span>Unfreeze frame</span>
          {:else}
            <Pin class="h-4 w-4 text-zinc-300" />
            <span>Freeze frame</span>
          {/if}
        </button>
      </Popover.Close>
    {/if}

    {#if onPreviewToggle}
      <Popover.Close class="contents">
        <button
          class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-zinc-700"
          onclick={onPreviewToggle}
        >
          {#if previewVisible}
            <EyeOff class="h-4 w-4 text-zinc-300" />
            <span>Hide preview</span>
          {:else}
            <Eye class="h-4 w-4 text-zinc-300" />
            <span>Show preview</span>
          {/if}
        </button>
      </Popover.Close>
    {/if}

    <Popover.Close class="contents">
      <button
        class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-zinc-700"
        onclick={onOpenHelp}
      >
        <CircleHelp class="h-4 w-4 text-zinc-300" />
        <span>Help</span>
      </button>
    </Popover.Close>
  </Popover.Content>
</Popover.Root>
