<script lang="ts">
  import { X, Folder, Bookmark, Package, Save } from '@lucide/svelte/icons';
  import FileTreeView from './FileTreeView.svelte';
  import PresetTreeView from './PresetTreeView.svelte';
  import ExtensionsView from './ExtensionsView.svelte';
  import SavesTreeView from './SavesTreeView.svelte';
  import type { SidebarView } from '../../../stores/ui.store';

  let {
    open = $bindable(false),
    view = $bindable<SidebarView>('files')
  }: {
    open: boolean;
    view?: SidebarView;
  } = $props();

  const views: { id: SidebarView; icon: typeof Folder; title: string }[] = [
    { id: 'files', icon: Folder, title: 'Files' },
    { id: 'presets', icon: Bookmark, title: 'Presets' },
    { id: 'saves', icon: Save, title: 'Saves' },
    { id: 'packs', icon: Package, title: 'Packs' }
  ];
</script>

{#if open}
  <div class="flex h-full w-full shrink-0 flex-col border-r border-zinc-700 bg-zinc-950 sm:w-64">
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
        <SavesTreeView />
      {/if}
    </div>
  </div>
{/if}
