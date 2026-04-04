<script lang="ts">
  import * as Popover from '$lib/components/ui/popover';
  import {
    Expand,
    Plus,
    Trash2,
    EllipsisVertical,
    Eye,
    EyeOff,
    Monitor,
    MonitorOff,
    Grid2x2,
    Pentagon
  } from '@lucide/svelte/icons';
  import type { ProjMapSurfaceMode } from './types';

  let {
    selected,
    activeSurfaceId,
    activeSurfaceMode,
    showOverlay,
    isOutputOverride,
    onexpand,
    onaddsurface,
    ondeletesurface,
    ontogglemode,
    ontoggleoverlay,
    ontoggleoutput
  }: {
    selected: boolean;
    activeSurfaceId: string | null;
    activeSurfaceMode: ProjMapSurfaceMode;
    showOverlay: boolean;
    isOutputOverride: boolean;
    onexpand: () => void;
    onaddsurface: () => void;
    ondeletesurface: () => void;
    ontogglemode: () => void;
    ontoggleoverlay: () => void;
    ontoggleoutput: () => void;
  } = $props();

  let open = $state(false);
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    <button
      class={[
        'cursor-pointer rounded p-1 transition-opacity hover:bg-zinc-700',
        !open && (selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')
      ]}
    >
      <EllipsisVertical class="h-4 w-4 text-zinc-400" />
    </button>
  </Popover.Trigger>

  <Popover.Content
    class="w-60 p-1"
    side="right"
    align="start"
    sideOffset={10}
    onCloseAutoFocus={(e) => e.preventDefault()}
  >
    <button
      class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-700"
      onclick={() => {
        onexpand();
        open = false;
      }}
    >
      <Expand class="h-4 w-4 text-zinc-400" />
      Expand editor
    </button>

    <div class="my-1 border-t border-zinc-700"></div>

    <button
      class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-700"
      onclick={() => {
        onaddsurface();
        open = false;
      }}
    >
      <Plus class="h-4 w-4 text-zinc-400" />
      Add surface
    </button>

    <button
      class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
      onclick={() => {
        ondeletesurface();
        open = false;
      }}
      disabled={!activeSurfaceId}
    >
      <Trash2 class="h-4 w-4 text-zinc-400" />
      Delete surface
    </button>

    <button
      class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
      onclick={() => {
        ontogglemode();
        open = false;
      }}
      disabled={!activeSurfaceId}
    >
      {#if activeSurfaceMode === 'warp'}
        <Pentagon class="h-4 w-4 text-zinc-400" />
        Switch to mask mode
      {:else}
        <Grid2x2 class="h-4 w-4 text-zinc-400" />
        Switch to warp mode
      {/if}
    </button>

    <div class="my-1 border-t border-zinc-700"></div>

    <button
      class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-700"
      onclick={() => {
        ontoggleoverlay();
        open = false;
      }}
    >
      {#if showOverlay}
        <EyeOff class="h-4 w-4 text-zinc-400" />
        Hide overlay
      {:else}
        <Eye class="h-4 w-4 text-zinc-400" />
        Show overlay
      {/if}
    </button>

    <button
      class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-700"
      onclick={() => {
        ontoggleoutput();
        open = false;
      }}
    >
      {#if isOutputOverride}
        <MonitorOff class="h-4 w-4 text-orange-400" />
        <span class="text-orange-400">Remove background output</span>
      {:else}
        <Monitor class="h-4 w-4 text-zinc-400" />
        Output to background
      {/if}
    </button>
  </Popover.Content>
</Popover.Root>
