<script lang="ts">
  import {
    Bookmark,
    CirclePlus,
    CircleHelp,
    Command,
    Copy,
    FilePlusCorner,
    FolderOpen,
    PanelLeftOpen,
    PanelLeftClose,
    Link,
    Loader,
    Save,
    Search,
    Sparkles,
    Trash2,
    Cable,
    ClipboardPaste,
    Ellipsis
  } from '@lucide/svelte/icons';
  import type { Node, Edge } from '@xyflow/svelte';
  import { match } from 'ts-pattern';
  import {
    isAiFeaturesVisible,
    isConnectionMode,
    isMobile,
    currentPatchName
  } from '../../stores/ui.store';
  import { aiButtonState } from '../../stores/ai-prompt.store';
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
    onSaveSelectedAsPreset,
    onQuickSave,
    onSaveAs,
    onOpenSaves
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
    onQuickSave: () => void;
    onSaveAs: () => void;
    onOpenSaves: () => void;
  } = $props();

  const hasSelection = $derived(selectedNodeIds.length > 0 || selectedEdgeIds.length > 0);
  const hasCopiedData = $derived(copiedNodeData && copiedNodeData.length > 0);
  const canCopy = $derived(selectedNodeIds.length > 0);
  const canPaste = $derived(selectedNodeIds.length === 0 && hasCopiedData);
  const canSaveAsPreset = $derived(selectedNodeIds.length === 1);
  const canConnect = $derived(nodes.length >= 2);
  const hasCurrentPatch = $derived(!!$currentPatchName);

  // Overflow menu state
  let overflowOpen = $state(false);

  // Hide toolbar on mobile when sidebar is open to prevent overlap
  const hideOnMobile = $derived($isMobile && isLeftSidebarOpen);

  const buttonClass =
    'cursor-pointer rounded bg-zinc-900/70 p-2 hover:bg-zinc-700 flex items-center justify-center';
  const activeButtonClass =
    'cursor-pointer rounded bg-blue-600/70 p-2 hover:bg-blue-800/70 flex items-center justify-center';
  const iconClass = 'h-4 w-4 text-zinc-300';

  // AI button classes based on mode
  const aiButtonClass = $derived(() => {
    if (!$aiButtonState.isActive) return buttonClass;

    return match($aiButtonState.mode)
      .with(
        'edit',
        () =>
          'cursor-pointer rounded bg-amber-600/70 p-2 hover:bg-amber-700/70 flex items-center justify-center'
      )
      .with(
        'multi',
        () =>
          'cursor-pointer rounded bg-blue-600/70 p-2 hover:bg-blue-700/70 flex items-center justify-center'
      )
      .otherwise(
        () =>
          'cursor-pointer rounded bg-purple-600/70 p-2 hover:bg-purple-700/70 flex items-center justify-center'
      );
  });

  // Menu item for overflow/drawer menus
  const menuItemClass =
    'flex items-center gap-3 w-full px-4 py-3 text-left text-sm text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700';

  function handleDelete() {
    const ok = confirm('Delete this element?');

    if (ok) {
      onDelete();
    }
  }

  function handleConnectionToggle() {
    if ($isConnectionMode) {
      onCancelConnectionMode();
    } else {
      onEnableConnectionMode();
    }
  }
</script>

{#if !hideOnMobile}
  <div
    class="bottom-safe fixed right-0 left-0 flex flex-col items-center gap-2 p-2 md:right-0 md:left-auto md:items-end"
  >
    <!-- Main toolbar row -->
    <div class="flex items-center gap-1">
      <!-- Selection actions (inline for both mobile and desktop) -->
      {#if hasSelection}
        <button title="Delete (Del)" class={buttonClass} onclick={handleDelete}>
          <Trash2 class="h-4 w-4 text-red-400" />
        </button>
      {/if}

      <button
        title="Browse Objects (Ctrl/Cmd+O)"
        class={buttonClass}
        onclick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onBrowseObjects();
        }}
      >
        <CirclePlus class={iconClass} />
      </button>

      {#if canCopy}
        <button title="Copy" class={buttonClass} onclick={onCopy}>
          <Copy class={iconClass} />
        </button>
      {/if}

      {#if canPaste}
        <button title="Paste" class={buttonClass} onclick={onPaste}>
          <ClipboardPaste class={iconClass} />
        </button>
      {/if}

      {#if canSaveAsPreset}
        <button title="Save as Preset" class={buttonClass} onclick={onSaveSelectedAsPreset}>
          <Bookmark class={iconClass} />
        </button>
      {/if}

      {#if $isAiFeaturesVisible && hasGeminiApiKey}
        <button title="AI Create/Edit" class={aiButtonClass()} onclick={onAiInsertOrEdit}>
          {#if $aiButtonState.isLoading}
            <Loader class="{iconClass} animate-spin cursor-not-allowed" />
          {:else}
            <Sparkles class={iconClass} />
          {/if}
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

      {#if !$isMobile}
        <VolumeControl />
      {/if}

      <button
        title={isLeftSidebarOpen ? 'Close Sidebar (Ctrl/Cmd+B)' : 'Open Sidebar (Ctrl/Cmd+B)'}
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
              <button
                class={menuItemClass}
                onclick={() => {
                  createAndCopyShareLink(nodes, edges);
                  overflowOpen = false;
                }}
              >
                <Link class="h-5 w-5 text-zinc-400" />
                <span>Share Patch Link</span>
              </button>

              <button
                class={menuItemClass}
                onclick={(e) => {
                  e.stopPropagation();
                  overflowOpen = false;
                  // Delay opening to let the drawer close first
                  setTimeout(() => onCommandPalette(), 0);
                }}
              >
                <Command class="h-5 w-5 text-zinc-400" />
                <span>Command Palette</span>
              </button>

              <button
                class={menuItemClass}
                onclick={() => {
                  onNewPatch();
                  overflowOpen = false;
                }}
              >
                <FilePlusCorner class="h-5 w-5 text-zinc-400" />
                <span>New Patch</span>
              </button>

              <button
                class={menuItemClass}
                onclick={() => {
                  overflowOpen = false;
                  onQuickSave();
                }}
              >
                <Save class="h-5 w-5 text-zinc-400" />
                <span>Save</span>
              </button>

              {#if hasCurrentPatch}
                <button
                  class={menuItemClass}
                  onclick={() => {
                    overflowOpen = false;
                    onSaveAs();
                  }}
                >
                  <Save class="h-5 w-5 text-zinc-400" />
                  <span>Save As...</span>
                </button>
              {/if}

              <button
                class={menuItemClass}
                onclick={() => {
                  overflowOpen = false;
                  onOpenSaves();
                }}
              >
                <FolderOpen class="h-5 w-5 text-zinc-400" />
                <span>Load Patch</span>
              </button>

              <button
                class={menuItemClass}
                onclick={() => {
                  showStartupModal = true;
                  overflowOpen = false;
                }}
              >
                <CircleHelp class="h-5 w-5 text-zinc-400" />
                <span>Help / Getting Started</span>
              </button>
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
              <button
                class="flex cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed"
                disabled={$aiButtonState.isLoading}
                onclick={() => {
                  createAndCopyShareLink(nodes, edges);
                  overflowOpen = false;
                }}
              >
                <Link class="h-4 w-4 text-zinc-400" />
                <span>Share Patch Link</span>
              </button>

              <button
                class="flex cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                onclick={(e) => {
                  e.stopPropagation();
                  overflowOpen = false;

                  // Delay opening to let the popover close first
                  setTimeout(() => onCommandPalette(), 0);
                }}
              >
                <Command class="h-4 w-4 text-zinc-400" />
                <span>Command Palette</span>
                <span class="ml-auto text-xs text-zinc-500">⌘K</span>
              </button>

              <button
                class="flex cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                onclick={() => {
                  onNewPatch();
                  overflowOpen = false;
                }}
              >
                <FilePlusCorner class="h-4 w-4 text-zinc-400" />
                <span>New Patch</span>
                <span class="ml-auto text-xs text-zinc-500">⌘N</span>
              </button>

              <button
                class="flex cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                onclick={() => {
                  overflowOpen = false;
                  onQuickSave();
                }}
              >
                <Save class="h-4 w-4 text-zinc-400" />
                <span>Save</span>
                <span class="ml-auto text-xs text-zinc-500">⌘S</span>
              </button>

              {#if hasCurrentPatch}
                <button
                  class="flex cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                  onclick={() => {
                    overflowOpen = false;
                    onSaveAs();
                  }}
                >
                  <Save class="h-4 w-4 text-zinc-400" />
                  <span>Save As...</span>
                  <span class="ml-auto text-xs text-zinc-500">⇧⌘S</span>
                </button>
              {/if}

              <button
                class="flex cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                onclick={() => {
                  overflowOpen = false;
                  onOpenSaves();
                }}
              >
                <FolderOpen class="h-4 w-4 text-zinc-400" />
                <span>Load Patch</span>
              </button>

              <button
                class="flex cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                onclick={() => {
                  showStartupModal = true;
                  overflowOpen = false;
                }}
              >
                <CircleHelp class="h-4 w-4 text-zinc-400" />
                <span>Help / Getting Started</span>
              </button>
            </div>
          </Popover.Content>
        </Popover.Root>
      {/if}
    </div>
  </div>
{/if}

<StartupModal bind:open={showStartupModal} onLoadPatch={async (patchId) => onLoadPatch(patchId)} />
