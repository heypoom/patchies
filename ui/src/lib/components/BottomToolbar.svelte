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
    ClipboardPaste,
    Ellipsis
  } from '@lucide/svelte/icons';
  import type { Node, Edge } from '@xyflow/svelte';
  import { isAiFeaturesVisible, isConnectionMode, isMobile } from '../../stores/ui.store';
  import { createAndCopyShareLink } from '$lib/save-load/share';
  import VolumeControl from './VolumeControl.svelte';
  import StartupModal from './startup-modal/StartupModal.svelte';
  import * as Popover from '$lib/components/ui/popover';
  import * as Drawer from '$lib/components/ui/drawer';

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
  const canCopy = $derived(selectedNodeIds.length > 0);
  const canPaste = $derived(selectedNodeIds.length === 0 && hasCopiedData);
  const canSaveAsPreset = $derived(selectedNodeIds.length === 1);
  const canConnect = $derived(nodes.length >= 2);

  // Drawer/popover states
  let overflowOpen = $state(false);
  let selectionDrawerOpen = $state(false);

  // Auto-open selection drawer on mobile when selection changes
  $effect(() => {
    if ($isMobile && hasSelection) {
      selectionDrawerOpen = true;
    }
  });

  const buttonClass =
    'cursor-pointer rounded bg-zinc-900/70 p-2 hover:bg-zinc-700 flex items-center justify-center';
  const activeButtonClass =
    'cursor-pointer rounded bg-blue-600/70 p-2 hover:bg-blue-800/70 flex items-center justify-center';
  const iconClass = 'h-4 w-4 text-zinc-300';

  // Menu item for overflow/drawer menus
  const menuItemClass =
    'flex items-center gap-3 w-full px-4 py-3 text-left text-sm text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700';

  function handleDelete() {
    const ok = confirm('Delete this element?');
    if (ok) {
      onDelete();
      selectionDrawerOpen = false;
    }
  }

  function handleCopy() {
    onCopy();
    selectionDrawerOpen = false;
  }

  function handlePaste() {
    onPaste();
    selectionDrawerOpen = false;
  }

  function handleSaveAsPreset() {
    onSaveSelectedAsPreset();
    selectionDrawerOpen = false;
  }

  function handleConnectionToggle() {
    if ($isConnectionMode) {
      onCancelConnectionMode();
    } else {
      onEnableConnectionMode();
    }
    selectionDrawerOpen = false;
  }
</script>

<div class="fixed right-0 bottom-0 flex flex-col items-end gap-2 p-2">
  <!-- Selection actions drawer for mobile -->
  {#if $isMobile && hasSelection}
    <Drawer.Root bind:open={selectionDrawerOpen}>
      <Drawer.Content class="bg-zinc-900">
        <Drawer.Header class="px-4 pt-2 pb-0">
          <Drawer.Title class="text-sm text-zinc-400">Selection Actions</Drawer.Title>
        </Drawer.Header>
        <div class="flex flex-col pb-6">
          <button class={menuItemClass} onclick={handleDelete}>
            <Trash2 class="h-5 w-5 text-red-400" />
            <span>Delete</span>
          </button>

          {#if canCopy}
            <button class={menuItemClass} onclick={handleCopy}>
              <Copy class="h-5 w-5 text-zinc-400" />
              <span>Copy</span>
            </button>
          {/if}

          {#if canSaveAsPreset}
            <button class={menuItemClass} onclick={handleSaveAsPreset}>
              <Bookmark class="h-5 w-5 text-zinc-400" />
              <span>Save as Preset</span>
            </button>
          {/if}

          {#if canConnect}
            <button class={menuItemClass} onclick={handleConnectionToggle}>
              <Cable class="h-5 w-5 text-zinc-400" />
              <span>{$isConnectionMode ? 'Exit Easy Connect' : 'Easy Connect'}</span>
            </button>
          {/if}
        </div>
      </Drawer.Content>
    </Drawer.Root>
  {/if}

  <!-- Main toolbar row -->
  <div class="flex items-center gap-1">
    <!-- Desktop-only: Selection actions inline -->
    {#if !$isMobile}
      {#if hasSelection}
        <button title="Delete (Del)" class={buttonClass} onclick={handleDelete}>
          <Trash2 class="h-4 w-4 text-red-400" />
        </button>
      {/if}

      {#if canCopy}
        <button title="Copy" class={buttonClass} onclick={handleCopy}>
          <Copy class={iconClass} />
        </button>
      {/if}

      {#if canPaste}
        <button title="Paste" class={buttonClass} onclick={handlePaste}>
          <ClipboardPaste class={iconClass} />
        </button>
      {/if}

      {#if canSaveAsPreset}
        <button title="Save as Preset" class={buttonClass} onclick={handleSaveAsPreset}>
          <Bookmark class={iconClass} />
        </button>
      {/if}

      {#if canConnect}
        <button
          title={$isConnectionMode ? 'Exit Easy Connect' : 'Easy Connect'}
          class={$isConnectionMode ? activeButtonClass : buttonClass}
          onclick={handleConnectionToggle}
        >
          <Cable class={iconClass} />
        </button>
      {/if}
    {/if}

    <!-- Primary actions (always visible) -->
    <button
      title="Quick Insert Object (Enter)"
      class={buttonClass}
      onclick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onInsertObject();
      }}
    >
      <CirclePlus class={iconClass} />
    </button>

    <button
      title="Browse Objects (Cmd+O)"
      class={buttonClass}
      onclick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onBrowseObjects();
      }}
    >
      <Search class={iconClass} />
    </button>

    <VolumeControl />

    <button
      title={isLeftSidebarOpen ? 'Close Sidebar (Cmd+B)' : 'Open Sidebar (Cmd+B)'}
      class={buttonClass}
      onclick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggleLeftSidebar();
      }}
    >
      {#if isLeftSidebarOpen}
        <PanelLeftClose class={iconClass} />
      {:else}
        <PanelLeftOpen class={iconClass} />
      {/if}
    </button>

    <!-- Overflow menu -->
    {#if $isMobile}
      <!-- Mobile: Drawer for overflow -->
      <Drawer.Root bind:open={overflowOpen}>
        <Drawer.Trigger class={buttonClass}>
          <Ellipsis class={iconClass} />
        </Drawer.Trigger>
        <Drawer.Content class="bg-zinc-900">
          <Drawer.Header class="px-4 pt-2 pb-0">
            <Drawer.Title class="text-sm text-zinc-400">More Actions</Drawer.Title>
          </Drawer.Header>
          <div class="flex flex-col pb-6">
            {#if $isAiFeaturesVisible && hasGeminiApiKey}
              <button
                class={menuItemClass}
                onclick={() => {
                  overflowOpen = false;
                  onAiInsertOrEdit();
                }}
              >
                <Sparkles class="h-5 w-5 text-zinc-400" />
                <span>AI Create/Edit</span>
              </button>
            {/if}

            <button
              class={menuItemClass}
              onclick={() => {
                overflowOpen = false;
                createAndCopyShareLink(nodes, edges);
              }}
            >
              <Link class="h-5 w-5 text-zinc-400" />
              <span>Share Patch Link</span>
            </button>

            <button
              class={menuItemClass}
              onclick={() => {
                overflowOpen = false;
                onCommandPalette();
              }}
            >
              <Command class="h-5 w-5 text-zinc-400" />
              <span>Command Palette</span>
            </button>

            <button
              class={menuItemClass}
              onclick={() => {
                overflowOpen = false;
                onNewPatch();
              }}
            >
              <FilePlusCorner class="h-5 w-5 text-zinc-400" />
              <span>New Patch</span>
            </button>

            {#if canPaste}
              <button
                class={menuItemClass}
                onclick={() => {
                  overflowOpen = false;
                  onPaste();
                }}
              >
                <ClipboardPaste class="h-5 w-5 text-zinc-400" />
                <span>Paste</span>
              </button>
            {/if}

            {#if canConnect}
              <button
                class={menuItemClass}
                onclick={() => {
                  overflowOpen = false;
                  handleConnectionToggle();
                }}
              >
                <Cable class="h-5 w-5 text-zinc-400" />
                <span>{$isConnectionMode ? 'Exit Easy Connect' : 'Easy Connect'}</span>
              </button>
            {/if}
          </div>
        </Drawer.Content>
      </Drawer.Root>
    {:else}
      <!-- Desktop: Popover for overflow -->
      <Popover.Root bind:open={overflowOpen}>
        <Popover.Trigger class={buttonClass}>
          <Ellipsis class={iconClass} />
        </Popover.Trigger>
        <Popover.Content
          class="w-56 border-zinc-700 bg-zinc-900 p-0"
          side="top"
          align="end"
          sideOffset={8}
        >
          <div class="flex flex-col py-1">
            {#if $isAiFeaturesVisible && hasGeminiApiKey}
              <button
                class="flex items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                onclick={() => {
                  overflowOpen = false;
                  onAiInsertOrEdit();
                }}
              >
                <Sparkles class="h-4 w-4 text-zinc-400" />
                <span>AI Create/Edit</span>
                <span class="ml-auto text-xs text-zinc-500">⌘I</span>
              </button>
            {/if}

            <button
              class="flex items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
              onclick={() => {
                overflowOpen = false;
                createAndCopyShareLink(nodes, edges);
              }}
            >
              <Link class="h-4 w-4 text-zinc-400" />
              <span>Share Patch Link</span>
            </button>

            <button
              class="flex items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
              onclick={() => {
                overflowOpen = false;
                onCommandPalette();
              }}
            >
              <Command class="h-4 w-4 text-zinc-400" />
              <span>Command Palette</span>
              <span class="ml-auto text-xs text-zinc-500">⌘K</span>
            </button>

            <button
              class="flex items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
              onclick={() => {
                overflowOpen = false;
                onNewPatch();
              }}
            >
              <FilePlusCorner class="h-4 w-4 text-zinc-400" />
              <span>New Patch</span>
              <span class="ml-auto text-xs text-zinc-500">⌘N</span>
            </button>
          </div>
        </Popover.Content>
      </Popover.Root>
    {/if}
  </div>
</div>

<StartupModal bind:open={showStartupModal} onLoadPatch={async (patchId) => onLoadPatch(patchId)} />
