<script lang="ts">
  import {
    X,
    Folder,
    Bookmark,
    Package,
    Save,
    CircleQuestionMark,
    AppWindow,
    Ellipsis,
    Music,
    MessageSquare,
    Activity
  } from '@lucide/svelte/icons';

  import FileTreeView from './FileTreeView.svelte';
  import PresetTreeView from './PresetTreeView.svelte';
  import ExtensionsView from './ExtensionsView.svelte';
  import SavesTreeView from './SavesTreeView.svelte';
  import HelpView from './HelpView.svelte';
  import AppPreviewView from './AppPreviewView.svelte';
  import SampleSearchView from './SampleSearchView.svelte';
  import ChatSessionsPanel from './ChatSessionsPanel.svelte';
  import ProfilerView from './ProfilerView.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import * as ContextMenu from '$lib/components/ui/context-menu';
  import * as Popover from '$lib/components/ui/popover';

  import {
    sidebarWidth,
    type SidebarView,
    SIDEBAR_MIN_WIDTH,
    SIDEBAR_MAX_WIDTH,
    isAiFeaturesVisible
  } from '../../../stores/ui.store';
  import { hasAppPreview } from '../../../stores/app-preview.store';
  import {
    sidebarVisibleTabs,
    toggleSidebarTab,
    showSidebarTab
  } from '../../../stores/sidebar-visibility.store';

  import type { AiPromptCallbacks } from '$lib/ai/ai-prompt-controller.svelte';
  import type { ChatNode, ChatGraphSummary, ChatViewportSummary } from '$lib/ai/chat/resolver';

  let {
    open = $bindable(false),
    view = $bindable<SidebarView>('files'),
    onSavePatch,
    onRequestApiKey,
    onOpenPatchToApp,
    aiCallbacks,
    getNodeById,
    getGraphSummary,
    getViewportSummary,
    hasGeminiApiKey = false
  }: {
    open: boolean;
    view?: SidebarView;
    onSavePatch?: () => void;
    onRequestApiKey?: (onKeyReady: () => void) => void;
    onOpenPatchToApp?: () => void;
    aiCallbacks?: AiPromptCallbacks;
    getNodeById?: (nodeId: string) => ChatNode | undefined;
    getGraphSummary?: () => ChatGraphSummary;
    getViewportSummary?: () => ChatViewportSummary;
    hasGeminiApiKey?: boolean;
  } = $props();

  // All sidebar views
  const allViews: { id: SidebarView; icon: typeof Folder; title: string; aiOnly?: boolean }[] = [
    { id: 'files', icon: Folder, title: 'Files' },
    { id: 'presets', icon: Bookmark, title: 'Presets' },
    { id: 'saves', icon: Save, title: 'Saves' },
    { id: 'help', icon: CircleQuestionMark, title: 'Help' },
    { id: 'packs', icon: Package, title: 'Packs' },
    { id: 'samples', icon: Music, title: 'Samples' },
    { id: 'chat', icon: MessageSquare, title: 'Chat', aiOnly: true },
    { id: 'preview', icon: AppWindow, title: 'Patch to App', aiOnly: true },
    { id: 'profiler', icon: Activity, title: 'Profiler' }
  ];

  const AI_VIEWS: SidebarView[] = ['chat', 'preview'];

  let showAiFeatures = $derived($isAiFeaturesVisible && hasGeminiApiKey);

  // Views available (respecting AI feature toggle)
  let availableViews = $derived(
    showAiFeatures ? allViews : allViews.filter((item) => !item.aiOnly)
  );

  // Views visible in the header bar
  let visibleViews = $derived(availableViews.filter((v) => $sidebarVisibleTabs.has(v.id)));

  // Whether there are hidden tabs (to show the ellipsis button)
  let hasHiddenTabs = $derived(visibleViews.length < availableViews.length);

  // Redirect away from AI views when AI features are hidden
  $effect(() => {
    if (!showAiFeatures && AI_VIEWS.includes(view)) {
      view = 'files';
    }
  });

  // Auto-show the preview tab when there's an active app preview
  $effect(() => {
    if ($hasAppPreview && !$sidebarVisibleTabs.has('preview') && showAiFeatures) {
      showSidebarTab('preview');
    }
  });

  // If the active view gets hidden, switch to the first visible tab
  $effect(() => {
    const visible = visibleViews;
    if (visible.length > 0 && !visible.some((v) => v.id === view)) {
      view = visible[0].id;
    }
  });

  function handleTabClick(id: SidebarView) {
    view = id;
  }

  function handleContextMenuToggle(id: SidebarView) {
    if (!$sidebarVisibleTabs.has(id)) {
      // Show the tab and switch to it
      showSidebarTab(id);
      view = id;
    } else {
      toggleSidebarTab(id);
    }
  }

  // Track which tab was right-clicked for the "Hide" action
  let contextMenuTargetTab = $state<SidebarView | null>(null);
  // Block tooltips while context menu is open; reset key on close to clear stale focus
  let tooltipsBlocked = $state(false);
  let tooltipResetKey = $state(0);

  function handleContextMenuOpenChange(open: boolean) {
    if (open) {
      tooltipsBlocked = true;
    } else {
      contextMenuTargetTab = null;
      tooltipResetKey++;
      tooltipsBlocked = false;
    }
  }
  let popoverOpen = $state(false);
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
    class="relative flex h-dvh w-full shrink-0 flex-col overflow-hidden border-r border-zinc-700 bg-zinc-950 sm:h-full"
    style:--sidebar-width="{$sidebarWidth}px"
    class:sm:w-[var(--sidebar-width)]={true}
    data-sidebar
  >
    <!-- Header with view switcher -->
    <div class="pt-safe flex flex-col border-b border-zinc-700">
      <ContextMenu.Root onOpenChange={handleContextMenuOpenChange}>
        <ContextMenu.Trigger class="flex items-center justify-between px-2 py-1.5">
          <!-- View switcher icons -->
          <div class="flex items-center gap-0.5">
            {#key tooltipResetKey}
              {#each visibleViews as v (v.id)}
                <Tooltip.Root delayDuration={300}>
                  <Tooltip.Trigger>
                    <button
                      class="cursor-pointer rounded p-1.5 transition-colors {view === v.id
                        ? 'bg-zinc-700 text-zinc-200'
                        : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}"
                      onclick={() => handleTabClick(v.id)}
                      oncontextmenu={() => (contextMenuTargetTab = v.id)}
                    >
                      <v.icon class="h-4 w-4" />
                    </button>
                  </Tooltip.Trigger>
                  {#if !tooltipsBlocked}
                    <Tooltip.Content side="bottom">
                      {v.id === 'preview' && $hasAppPreview ? 'App Preview' : v.title}
                    </Tooltip.Content>
                  {/if}
                </Tooltip.Root>
              {/each}
            {/key}

            <!-- Ellipsis button to show/hide tabs (visible when tabs are hidden) -->
            {#if hasHiddenTabs}
              <Popover.Root open={popoverOpen} onOpenChange={(o) => (popoverOpen = o)}>
                <Popover.Trigger>
                  <button
                    class="cursor-pointer rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                  >
                    <Ellipsis class="h-4 w-4" />
                  </button>
                </Popover.Trigger>
                <Popover.Content side="bottom" align="start" class="w-auto min-w-[160px] p-1">
                  {#each availableViews as v (v.id)}
                    <button
                      class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-zinc-200 transition-colors hover:bg-zinc-800"
                      onclick={() => {
                        handleContextMenuToggle(v.id);
                        popoverOpen = false;
                      }}
                    >
                      <span class="flex h-4 w-4 items-center justify-center text-zinc-400">
                        {#if $sidebarVisibleTabs.has(v.id)}
                          <span class="text-xs">&#10003;</span>
                        {/if}
                      </span>
                      <v.icon class="h-3.5 w-3.5" />
                      <span>{v.title}</span>
                    </button>
                  {/each}
                </Popover.Content>
              </Popover.Root>
            {/if}
          </div>

          <button
            class="cursor-pointer rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
            onclick={() => (open = false)}
            title="Close sidebar"
          >
            <X class="h-4 w-4" />
          </button>
        </ContextMenu.Trigger>

        <ContextMenu.Content>
          {#if contextMenuTargetTab}
            {@const target = availableViews.find((v) => v.id === contextMenuTargetTab)}
            {#if target}
              <ContextMenu.Item onclick={() => toggleSidebarTab(target.id)}>
                Hide {target.title}
              </ContextMenu.Item>
              <ContextMenu.Separator />
            {/if}
          {/if}
          {#each availableViews as v (v.id)}
            <ContextMenu.CheckboxItem
              checked={$sidebarVisibleTabs.has(v.id)}
              onCheckedChange={() => handleContextMenuToggle(v.id)}
            >
              {v.title}
            </ContextMenu.CheckboxItem>
          {/each}
        </ContextMenu.Content>
      </ContextMenu.Root>
    </div>

    <!-- Content -->
    <!-- Chat sessions panel is always mounted to preserve state across tab switches -->
    <div class="min-h-0 flex-1 {view === 'chat' ? '' : 'hidden'}">
      <ChatSessionsPanel {aiCallbacks} {getNodeById} {getGraphSummary} {getViewportSummary} />
    </div>

    <!-- Profiler is always mounted to preserve recording state across tab switches -->
    <div class="min-h-0 flex-1 {view === 'profiler' ? '' : 'hidden'}">
      <ProfilerView />
    </div>

    {#if view !== 'chat' && view !== 'profiler'}
      <div class="min-h-0 flex-1 overflow-y-auto">
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
        {:else if view === 'samples'}
          <SampleSearchView />
        {:else if view === 'preview'}
          <AppPreviewView {onRequestApiKey} {onOpenPatchToApp} />
        {/if}
      </div>
    {/if}

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
