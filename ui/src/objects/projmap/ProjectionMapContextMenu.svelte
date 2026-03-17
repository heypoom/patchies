<script lang="ts">
  import * as ContextMenu from '$lib/components/ui/context-menu';
  import {
    Expand,
    Plus,
    Trash2,
    Monitor,
    MonitorOff,
    CircleQuestionMark,
    Pen,
    MousePointer2,
    Eye,
    EyeOff
  } from '@lucide/svelte/icons';
  import type { ProjMapSurface } from './types';

  let {
    surfaces,
    activeSurfaceId,
    contextMenuSurfaceId,
    editMode,
    isOutputOverride,
    showOverlay,
    onexpand,
    onaddsurface,
    ondeletesurface,
    ontogglemode,
    ontoggleoutput,
    ontoggleoverlay,
    onopenhelp
  }: {
    surfaces: ProjMapSurface[];
    activeSurfaceId: string | null;
    contextMenuSurfaceId: string | null;
    editMode: 'add' | 'move';
    isOutputOverride: boolean;
    onexpand: () => void;
    onaddsurface: () => void;
    ondeletesurface: (id: string) => void;
    ontogglemode: () => void;
    ontoggleoutput: () => void;
    ontoggleoverlay: () => void;
    onopenhelp: () => void;
    showOverlay: boolean;
  } = $props();

  let deleteTargetId = $derived(contextMenuSurfaceId ?? activeSurfaceId);

  let deleteTargetIndex = $derived(
    deleteTargetId ? surfaces.findIndex((s) => s.id === deleteTargetId) : -1
  );

  let deleteLabel = $derived(
    contextMenuSurfaceId && contextMenuSurfaceId !== activeSurfaceId
      ? `Delete surface ${deleteTargetIndex + 1}`
      : 'Delete surface'
  );
</script>

<ContextMenu.Content>
  <ContextMenu.Item onclick={ontogglemode}>
    {#if editMode === 'add'}
      <Pen class="mr-2 h-4 w-4" />
      Switch to move mode
    {:else}
      <MousePointer2 class="mr-2 h-4 w-4 text-blue-400" />
      Switch to add mode
    {/if}
  </ContextMenu.Item>

  <ContextMenu.Separator />

  <ContextMenu.Item onclick={onexpand}>
    <Expand class="mr-2 h-4 w-4" />
    Expand editor
  </ContextMenu.Item>

  <ContextMenu.Item onclick={ontoggleoutput}>
    {#if isOutputOverride}
      <MonitorOff class="mr-2 h-4 w-4 text-orange-400" />
      Remove background output
    {:else}
      <Monitor class="mr-2 h-4 w-4" />
      Output to background
    {/if}
  </ContextMenu.Item>

  <ContextMenu.Separator />

  <ContextMenu.Item onclick={onaddsurface}>
    <Plus class="mr-2 h-4 w-4" />
    Add surface
  </ContextMenu.Item>

  <ContextMenu.Item
    onclick={() => deleteTargetId && ondeletesurface(deleteTargetId)}
    disabled={!deleteTargetId}
  >
    <Trash2 class="mr-2 h-4 w-4" />
    {deleteLabel}
  </ContextMenu.Item>

  <ContextMenu.Item onclick={ontoggleoverlay}>
    {#if showOverlay}
      <EyeOff class="mr-2 h-4 w-4" />
      Hide overlay
    {:else}
      <Eye class="mr-2 h-4 w-4" />
      Show overlay
    {/if}
  </ContextMenu.Item>

  <ContextMenu.Separator />

  <ContextMenu.Item onclick={onopenhelp}>
    <CircleQuestionMark class="mr-2 h-4 w-4" />
    Help
  </ContextMenu.Item>
</ContextMenu.Content>
