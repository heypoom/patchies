<script lang="ts">
  import { X, Folder, Bookmark, Package, Save, CircleQuestionMark } from '@lucide/svelte/icons';

  import FileTreeView from './FileTreeView.svelte';
  import PresetTreeView from './PresetTreeView.svelte';
  import ExtensionsView from './ExtensionsView.svelte';
  import SavesTreeView from './SavesTreeView.svelte';
  import HelpView from './HelpView.svelte';

  import { sidebarWidth, type SidebarView } from '../../../stores/ui.store';

  let {
    open = $bindable(false),
    view = $bindable<SidebarView>('files'),
    onSavePatch
  }: {
    open: boolean;
    view?: SidebarView;
    onSavePatch?: () => void;
  } = $props();

  const views: { id: SidebarView; icon: typeof Folder; title: string }[] = [
    { id: 'files', icon: Folder, title: 'Files' },
    { id: 'presets', icon: Bookmark, title: 'Presets' },
    { id: 'saves', icon: Save, title: 'Saves' },
    { id: 'packs', icon: Package, title: 'Packs' },
    { id: 'help', icon: CircleQuestionMark, title: 'Help' }
  ];

  const MIN_WIDTH = 180;
  const MAX_WIDTH = 600;

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
    const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
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
  >
    <!-- Header with view switcher -->
    <div class="flex items-center justify-between border-b border-zinc-700 px-2 py-1.5">
      <!-- View switcher icons -->
      <div class="flex items-center gap-0.5">
        {#each views as v}
          <button
            class="cursor-pointer rounded p-1.5 transition-colors {view === v.id
              ? 'bg-zinc-700 text-zinc-200'
              : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}"
            onclick={() => (view = v.id)}
            title={v.title}
          >
            <v.icon class="h-4 w-4" />
          </button>
        {/each}
      </div>

      <button
        class="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
        onclick={() => (open = false)}
        title="Close sidebar"
      >
        <X class="h-4 w-4" />
      </button>
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
