<script lang="ts">
  import {
    X,
    Folder,
    Bookmark,
    Package,
    Save,
    CircleQuestionMark,
    AppWindow,
    ChevronDown,
    ChevronUp
  } from '@lucide/svelte/icons';

  import FileTreeView from './FileTreeView.svelte';
  import PresetTreeView from './PresetTreeView.svelte';
  import ExtensionsView from './ExtensionsView.svelte';
  import SavesTreeView from './SavesTreeView.svelte';
  import HelpView from './HelpView.svelte';
  import AppPreviewView from './AppPreviewView.svelte';
  import { usePreviewTab } from './usePreviewTab.svelte';

  import {
    sidebarWidth,
    type SidebarView,
    SIDEBAR_MIN_WIDTH,
    SIDEBAR_MAX_WIDTH
  } from '../../../stores/ui.store';
  import { hasAppPreview } from '../../../stores/app-preview.store';

  let {
    open = $bindable(false),
    view = $bindable<SidebarView>('files'),
    onSavePatch,
    onRequestApiKey,
    onOpenPatchToApp
  }: {
    open: boolean;
    view?: SidebarView;
    onSavePatch?: () => void;
    onRequestApiKey?: (onKeyReady: () => void) => void;
    onOpenPatchToApp?: () => void;
  } = $props();

  // Base views always shown
  const baseViews: { id: SidebarView; icon: typeof Folder; title: string }[] = [
    { id: 'files', icon: Folder, title: 'Files' },
    { id: 'presets', icon: Bookmark, title: 'Presets' },
    { id: 'saves', icon: Save, title: 'Saves' },
    { id: 'packs', icon: Package, title: 'Packs' },
    { id: 'help', icon: CircleQuestionMark, title: 'Help' }
  ];

  // Expandable items (just Patch to App for now)
  const expandableItems = [
    { id: 'preview' as SidebarView, icon: AppWindow, title: 'Patch to App' }
  ];

  // Preview tab promotion logic
  const previewTab = usePreviewTab({
    getView: () => view,
    setView: (v) => (view = v),
    getHasPreview: () => $hasAppPreview
  });

  // State for the expandable section
  let isExpanded = $state(false);

  function handleExpandableItemClick() {
    previewTab.handleExpandableItemClick();
    isExpanded = false;
  }

  let isDragging = $state(false);

  function handlePointerDown(e: PointerEvent) {
    e.preventDefault();
    isDragging = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const target = e.target as HTMLElement;
    target.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging) return;
    const newWidth = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, e.clientX));
    sidebarWidth.set(newWidth);
  }

  function handlePointerUp(e: PointerEvent) {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    const target = e.target as HTMLElement;
    target.releasePointerCapture(e.pointerId);
  }
</script>

{#if open}
  <div
    class="relative flex h-full w-full shrink-0 flex-col border-r border-zinc-700 bg-zinc-950"
    style:--sidebar-width="{$sidebarWidth}px"
    class:sm:w-[var(--sidebar-width)]={true}
    data-sidebar
  >
    <!-- Header with view switcher -->
    <div class="flex flex-col border-b border-zinc-700">
      <div class="flex items-center justify-between px-2 py-1.5">
        <!-- View switcher icons -->
        <div class="flex items-center gap-0.5">
          {#each baseViews as v}
            <button
              class="cursor-pointer rounded p-1.5 transition-colors {view === v.id
                ? 'bg-zinc-700 text-zinc-200'
                : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}"
              onclick={() => previewTab.handleBaseViewClick(v.id)}
              title={v.title}
            >
              <v.icon class="h-4 w-4" />
            </button>
          {/each}

          <!-- Promoted preview button (when active) -->
          {#if previewTab.isPromoted}
            <button
              class="cursor-pointer rounded p-1.5 transition-colors {view === 'preview'
                ? 'bg-zinc-700 text-zinc-200'
                : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}"
              onclick={previewTab.handlePromotedClick}
              title={$hasAppPreview ? 'App Preview' : 'Patch to App'}
            >
              <AppWindow class="h-4 w-4" />
            </button>
          {/if}

          <!-- Expand/collapse chevron -->
          <button
            class="cursor-pointer rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            onclick={() => (isExpanded = !isExpanded)}
            title={isExpanded ? 'Collapse' : 'More options'}
          >
            {#if isExpanded}
              <ChevronUp class="h-4 w-4" />
            {:else}
              <ChevronDown class="h-4 w-4" />
            {/if}
          </button>
        </div>

        <button
          class="cursor-pointer rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
          onclick={() => (open = false)}
          title="Close sidebar"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <!-- Expanded section -->
      {#if isExpanded}
        <div class="flex items-center gap-1 border-t border-zinc-800 px-2 py-1.5">
          {#each expandableItems as item}
            {#if !previewTab.isPromoted || item.id !== 'preview'}
              <button
                class="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                onclick={handleExpandableItemClick}
                title={item.title}
              >
                <item.icon class="h-3.5 w-3.5" />
                <span>{item.title}</span>
              </button>
            {/if}
          {/each}
          {#if previewTab.isPromoted && expandableItems.length === 1}
            <span class="text-xs text-zinc-600 italic">No more items</span>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto">
      {#if view === 'files'}
        <FileTreeView />
      {:else if view === 'presets'}
        <PresetTreeView />
      {:else if view === 'packs'}
        <ExtensionsView />
      {:else if view === 'saves'}
        <SavesTreeView {onSavePatch} />
      {:else if view === 'help'}
        <HelpView />
      {:else if view === 'preview'}
        <AppPreviewView {onRequestApiKey} {onOpenPatchToApp} />
      {/if}
    </div>

    <!-- Resize handle (desktop only) -->
    <div
      class="absolute top-0 right-0 hidden h-full w-1 cursor-col-resize hover:bg-zinc-600 sm:block {isDragging
        ? 'bg-zinc-500'
        : ''}"
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerup={handlePointerUp}
      role="separator"
      aria-orientation="vertical"
      tabindex="-1"
    ></div>
  </div>
{/if}
