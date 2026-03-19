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
    ChevronUp,
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
  import { usePreviewTab } from './usePreviewTab.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';

  import {
    sidebarWidth,
    type SidebarView,
    SIDEBAR_MIN_WIDTH,
    SIDEBAR_MAX_WIDTH,
    isAiFeaturesVisible
  } from '../../../stores/ui.store';
  import { hasAppPreview } from '../../../stores/app-preview.store';

  import type { AiPromptCallbacks } from '$lib/ai/ai-prompt-controller.svelte';
  import type { ChatNode, ChatGraphSummary } from '$lib/ai/chat/resolver';

  let {
    open = $bindable(false),
    view = $bindable<SidebarView>('files'),
    onSavePatch,
    onRequestApiKey,
    onOpenPatchToApp,
    aiCallbacks,
    getNodeById,
    getGraphSummary,
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
    hasGeminiApiKey?: boolean;
  } = $props();

  // Base views always shown
  const baseViews: { id: SidebarView; icon: typeof Folder; title: string }[] = [
    { id: 'files', icon: Folder, title: 'Files' },
    { id: 'presets', icon: Bookmark, title: 'Presets' },
    { id: 'saves', icon: Save, title: 'Saves' },
    { id: 'packs', icon: Package, title: 'Packs' },
    { id: 'help', icon: CircleQuestionMark, title: 'Help' }
  ];

  // Expandable items (shown under chevron, promoted to top bar when active)
  const allExpandableItems = [
    { id: 'samples', icon: Music, title: 'Samples' },
    { id: 'chat', icon: MessageSquare, title: 'Chat', aiOnly: true },
    { id: 'preview', icon: AppWindow, title: 'Patch to App', aiOnly: true },
    { id: 'profiler', icon: Activity, title: 'Profiler' }
  ];

  const AI_VIEWS: SidebarView[] = ['chat', 'preview'];

  let showAiFeatures = $derived($isAiFeaturesVisible && hasGeminiApiKey);

  let expandableItems = $derived(
    showAiFeatures ? allExpandableItems : allExpandableItems.filter((item) => !item.aiOnly)
  );

  // Preview tab promotion logic
  const previewTab = usePreviewTab({
    getView: () => view,
    setView: (v) => (view = v),
    getHasPreview: () => $hasAppPreview
  });

  // State for the expandable section
  let isExpanded = $state(false);
  // Tracks whether expandable views have been promoted to the top bar
  let isSamplesPromoted = $derived(view === 'samples');
  let isChatPromoted = $derived(view === 'chat' && showAiFeatures);
  let isProfilerPromoted = $derived(view === 'profiler');

  // Redirect away from AI views when AI features are hidden
  $effect(() => {
    if (!showAiFeatures && AI_VIEWS.includes(view)) {
      view = 'files';
    }
  });

  function handleExpandableItemClick(id: SidebarView) {
    if (id === 'preview') {
      previewTab.handleExpandableItemClick();
    } else {
      view = id;
    }
    isExpanded = false;
  }

  function handleBaseViewClick(id: SidebarView) {
    previewTab.handleBaseViewClick(id);
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
    class="relative flex h-dvh w-full shrink-0 flex-col overflow-hidden border-r border-zinc-700 bg-zinc-950 sm:h-full"
    style:--sidebar-width="{$sidebarWidth}px"
    class:sm:w-[var(--sidebar-width)]={true}
    data-sidebar
  >
    <!-- Header with view switcher -->
    <div class="pt-safe flex flex-col border-b border-zinc-700">
      <div class="flex items-center justify-between px-2 py-1.5">
        <!-- View switcher icons -->
        <div class="flex items-center gap-0.5">
          {#each baseViews as v}
            <button
              class="cursor-pointer rounded p-1.5 transition-colors {view === v.id
                ? 'bg-zinc-700 text-zinc-200'
                : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}"
              onclick={() => handleBaseViewClick(v.id)}
              title={v.title}
            >
              <v.icon class="h-4 w-4" />
            </button>
          {/each}

          <!-- Promoted preview button (when active) -->
          {#if previewTab.isPromoted && showAiFeatures}
            <Tooltip.Root delayDuration={300}>
              <Tooltip.Trigger>
                <button
                  class="cursor-pointer rounded p-1.5 transition-colors {view === 'preview'
                    ? 'bg-zinc-700 text-zinc-200'
                    : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}"
                  onclick={previewTab.handlePromotedClick}
                >
                  <AppWindow class="h-4 w-4" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content side="bottom">
                {$hasAppPreview ? 'App Preview' : 'Patch to App'}
              </Tooltip.Content>
            </Tooltip.Root>
          {/if}

          <!-- Promoted samples button (when active) -->
          {#if isSamplesPromoted}
            <Tooltip.Root delayDuration={300}>
              <Tooltip.Trigger>
                <button
                  class="cursor-pointer rounded p-1.5 transition-colors {view === 'samples'
                    ? 'bg-zinc-700 text-zinc-200'
                    : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}"
                  onclick={() => (view = 'samples')}
                >
                  <Music class="h-4 w-4" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content side="bottom">Samples</Tooltip.Content>
            </Tooltip.Root>
          {/if}

          <!-- Promoted chat button (when active) -->
          {#if isChatPromoted}
            <Tooltip.Root delayDuration={300}>
              <Tooltip.Trigger>
                <button
                  class="cursor-pointer rounded p-1.5 transition-colors {view === 'chat'
                    ? 'bg-zinc-700 text-zinc-200'
                    : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}"
                  onclick={() => (view = 'chat')}
                >
                  <MessageSquare class="h-4 w-4" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content side="bottom">Chat</Tooltip.Content>
            </Tooltip.Root>
          {/if}

          <!-- Promoted profiler button (when active) -->
          {#if isProfilerPromoted}
            <Tooltip.Root delayDuration={300}>
              <Tooltip.Trigger>
                <button
                  class="cursor-pointer rounded p-1.5 transition-colors {view === 'profiler'
                    ? 'bg-zinc-700 text-zinc-200'
                    : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}"
                  onclick={() => (view = 'profiler')}
                >
                  <Activity class="h-4 w-4" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content side="bottom">Profiler</Tooltip.Content>
            </Tooltip.Root>
          {/if}

          <!-- Expand/collapse chevron -->
          <Tooltip.Root delayDuration={300}>
            <Tooltip.Trigger>
              <button
                class="cursor-pointer rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                onclick={() => (isExpanded = !isExpanded)}
              >
                {#if isExpanded}
                  <ChevronUp class="h-4 w-4" />
                {:else}
                  <ChevronDown class="h-4 w-4" />
                {/if}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content side="bottom">
              {isExpanded ? 'Collapse' : 'More options'}
            </Tooltip.Content>
          </Tooltip.Root>
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
        <div class="flex flex-wrap items-center gap-1 border-t border-zinc-800 px-2 py-1.5">
          {#each expandableItems as item (item.id)}
            {#if (!previewTab.isPromoted || item.id !== 'preview') && (!isSamplesPromoted || item.id !== 'samples') && (!isChatPromoted || item.id !== 'chat') && (!isProfilerPromoted || item.id !== 'profiler')}
              <button
                class="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                onclick={() => handleExpandableItemClick(item.id as SidebarView)}
                title={item.title}
              >
                <item.icon class="h-3.5 w-3.5" />
                <span>{item.title}</span>
              </button>
            {/if}
          {/each}

          {#if expandableItems.every((item) => (item.id === 'preview' && previewTab.isPromoted) || (item.id === 'samples' && isSamplesPromoted) || (item.id === 'chat' && isChatPromoted) || (item.id === 'profiler' && isProfilerPromoted))}
            <span class="text-xs text-zinc-600 italic">No more items</span>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Content -->
    <!-- Chat sessions panel is always mounted to preserve state across tab switches -->
    <div class="min-h-0 flex-1 {view === 'chat' ? '' : 'hidden'}">
      <ChatSessionsPanel {aiCallbacks} {getNodeById} {getGraphSummary} />
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
