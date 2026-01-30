<script lang="ts">
  import {
    Bookmark,
    CirclePlus,
    Command,
    Copy,
    FilePlusCorner,
    PanelLeftOpen,
    PanelLeftClose,
    Link,
    Search,
    Sparkles,
    Trash2,
    Cable,
    ClipboardPaste
  } from '@lucide/svelte/icons';
  import type { Node, Edge } from '@xyflow/svelte';
  import { isAiFeaturesVisible, isConnectionMode } from '../../stores/ui.store';
  import { createAndCopyShareLink } from '$lib/save-load/share';
  import VolumeControl from './VolumeControl.svelte';
  import StartupModal from './startup-modal/StartupModal.svelte';

  let {
    nodes,
    edges,
    selectedNodeIds,
    selectedEdgeIds,
    copiedNodeData,
    hasGeminiApiKey,
    showStartupModal = $bindable(false),
    isLeftSidebarOpen = false,
    onDelete,
    onInsertObject,
    onBrowseObjects,
    onCopy,
    onPaste,
    onCancelConnectionMode,
    onEnableConnectionMode,
    onAiInsertOrEdit,
    onCommandPalette,
    onNewPatch,
    onLoadPatch,
    onToggleLeftSidebar,
    onSaveSelectedAsPreset
  }: {
    nodes: Node[];
    edges: Edge[];
    selectedNodeIds: string[];
    selectedEdgeIds: string[];
    copiedNodeData: Array<{
      type: string;
      data: any;
      relativePosition: { x: number; y: number };
    }> | null;
    hasGeminiApiKey: boolean;
    showStartupModal: boolean;
    isLeftSidebarOpen: boolean;
    onDelete: () => void;
    onInsertObject: () => void;
    onBrowseObjects: () => void;
    onCopy: () => void;
    onPaste: () => void;
    onCancelConnectionMode: () => void;
    onEnableConnectionMode: () => void;
    onAiInsertOrEdit: () => void;
    onCommandPalette: () => void;
    onNewPatch: () => void;
    onLoadPatch: (patchId: string) => void | Promise<void>;
    onToggleLeftSidebar: () => void;
    onSaveSelectedAsPreset: () => void;
  } = $props();

  const hasSelection = $derived(selectedNodeIds.length > 0 || selectedEdgeIds.length > 0);
  const hasCopiedData = $derived(copiedNodeData && copiedNodeData.length > 0);
  const showCopyPasteButton = $derived(
    selectedNodeIds.length > 0 || (selectedNodeIds.length === 0 && hasCopiedData)
  );
  const canSaveAsPreset = $derived(selectedNodeIds.length === 1);
</script>

<div class="fixed right-0 bottom-0 p-2">
  {#if hasSelection}
    <button
      title="Delete (Del)"
      class="cursor-pointer rounded bg-zinc-900/70 p-1 hover:bg-zinc-700"
      onclick={(e) => {
        e.preventDefault();
        e.stopPropagation();

        const ok = confirm('Delete this element?');

        if (ok) {
          onDelete();
        }
      }}><Trash2 class="h-4 w-4 text-red-400" /></button
    >
  {/if}

  <button
    title="Quick Insert Object (Enter)"
    class="cursor-pointer rounded bg-zinc-900/70 p-1 hover:bg-zinc-700"
    onclick={(e) => {
      e.preventDefault();
      e.stopPropagation();

      onInsertObject();
    }}><CirclePlus class="h-4 w-4 text-zinc-300" /></button
  >

  <button
    title="Browse Objects (Cmd+B)"
    class="cursor-pointer rounded bg-zinc-900/70 p-1 hover:bg-zinc-700"
    onclick={(e) => {
      e.preventDefault();
      e.stopPropagation();

      onBrowseObjects();
    }}><Search class="h-4 w-4 text-zinc-300" /></button
  >

  {#if showCopyPasteButton}
    <button
      title="Copy / Paste"
      class="cursor-pointer rounded bg-zinc-900/70 p-1 hover:bg-zinc-700"
      onclick={(e) => {
        e.preventDefault();
        e.stopPropagation();

        if (selectedNodeIds.length === 0 && hasCopiedData) {
          onPaste();
        } else if (selectedNodeIds.length > 0 && !hasCopiedData) {
          onCopy();
        }
      }}
    >
      {#if selectedNodeIds.length === 0 && hasCopiedData}
        <ClipboardPaste class="h-4 w-4 text-zinc-300" />
      {:else}
        <Copy class="h-4 w-4 text-zinc-300" />
      {/if}
    </button>
  {/if}

  {#if canSaveAsPreset}
    <button
      title="Save as Preset"
      class="cursor-pointer rounded bg-zinc-900/70 p-1 hover:bg-zinc-700"
      onclick={(e) => {
        e.preventDefault();
        e.stopPropagation();

        onSaveSelectedAsPreset();
      }}><Bookmark class="h-4 w-4 text-zinc-300" /></button
    >
  {/if}

  <!-- Only show connection button if there are at least 2 nodes -->
  <!-- You can't connect a single node to itself -->
  {#if nodes.length >= 2}
    <button
      title={$isConnectionMode ? 'Exit Easy Connect' : 'Easy Connect'}
      class={`cursor-pointer rounded p-1 ${$isConnectionMode ? 'bg-blue-600/70 hover:bg-blue-800/70' : 'bg-zinc-900/70 hover:bg-zinc-700'}`}
      onclick={(e) => {
        e.preventDefault();
        e.stopPropagation();

        if ($isConnectionMode) {
          onCancelConnectionMode();
        } else {
          onEnableConnectionMode();
        }
      }}><Cable class="h-4 w-4 text-zinc-300" /></button
    >
  {/if}

  {#if $isAiFeaturesVisible && hasGeminiApiKey}
    <button
      title="AI Create/Edit Object (Cmd+I)"
      class="cursor-pointer rounded bg-zinc-900/70 p-1 hover:bg-zinc-700"
      onclick={(e) => {
        e.preventDefault();
        e.stopPropagation();

        onAiInsertOrEdit();
      }}><Sparkles class="h-4 w-4 text-zinc-300" /></button
    >
  {/if}

  <button
    title="Share Patch Link"
    class="cursor-pointer rounded bg-zinc-900/70 p-1 hover:bg-zinc-700"
    onclick={() => createAndCopyShareLink(nodes, edges)}
    ><Link class="h-4 w-4 text-zinc-300" /></button
  >

  <button
    title="Command Palette (Cmd+K)"
    class="cursor-pointer rounded bg-zinc-900/70 p-1 hover:bg-zinc-700"
    onclick={(e) => {
      e.preventDefault();
      e.stopPropagation();

      onCommandPalette();
    }}><Command class="h-4 w-4 text-zinc-300" /></button
  >

  <VolumeControl />

  <button
    title="New Patch"
    class="cursor-pointer rounded bg-zinc-900/70 p-1 hover:bg-zinc-700"
    onclick={(e) => {
      e.preventDefault();
      e.stopPropagation();

      onNewPatch();
    }}><FilePlusCorner class="h-4 w-4 text-zinc-300 hover:text-red-400" /></button
  >

  <button
    title={isLeftSidebarOpen ? 'Close Sidebar' : 'Open Sidebar'}
    class="cursor-pointer rounded bg-zinc-900/70 p-1 hover:bg-zinc-700"
    onclick={(e) => {
      e.preventDefault();
      e.stopPropagation();

      onToggleLeftSidebar();
    }}
  >
    {#if isLeftSidebarOpen}
      <PanelLeftClose class="h-4 w-4 text-zinc-300" />
    {:else}
      <PanelLeftOpen class="h-4 w-4 text-zinc-300" />
    {/if}
  </button>

  <StartupModal
    bind:open={showStartupModal}
    onLoadPatch={async (patchId) => onLoadPatch(patchId)}
  />
</div>
