<script lang="ts" module>
  import type { Component } from 'svelte';

  export interface FolderNode {
    id: string;
    name: string;
    icon?: Component;
    iconClass?: string;
    children: FolderNode[];
    disabled?: boolean;
  }
</script>

<script lang="ts">
  import { ChevronRight, ChevronDown, Folder, FolderOpen } from '@lucide/svelte/icons';
  import * as Dialog from '$lib/components/ui/dialog';

  let {
    open = $bindable(false),
    title = 'Select folder',
    description = 'Choose a destination folder',
    confirmText = 'Select',
    folders,
    onSelect
  }: {
    open: boolean;
    title?: string;
    description?: string;
    confirmText?: string;
    folders: FolderNode[];
    onSelect: (folderId: string) => void;
  } = $props();

  let expandedIds = $state(new Set<string>());
  let selectedId = $state<string | null>(null);

  // Auto-expand root folders and reset selection when dialog opens
  $effect(() => {
    if (open && folders.length > 0) {
      const rootIds = folders.map((f) => f.id);
      expandedIds = new Set(rootIds);
      selectedId = null;
    }
  });

  function toggleExpanded(id: string, e: MouseEvent) {
    e.stopPropagation();
    if (expandedIds.has(id)) {
      expandedIds.delete(id);
    } else {
      expandedIds.add(id);
    }
    expandedIds = new Set(expandedIds);
  }

  function handleRowClick(node: FolderNode) {
    if (node.disabled) return;
    selectedId = node.id;
  }

  function handleConfirm() {
    if (selectedId) {
      onSelect(selectedId);
      open = false;
    }
  }

  function handleCancel() {
    open = false;
  }
</script>

{#snippet folderItem(node: FolderNode, depth: number)}
  {@const isExpanded = expandedIds.has(node.id)}
  {@const hasChildren = node.children.length > 0}
  {@const paddingLeft = depth * 16 + 12}
  {@const IconComponent = node.icon}
  {@const isSelected = selectedId === node.id}

  <div class="flex flex-col">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="flex w-full cursor-pointer items-center gap-2 py-2 text-left text-sm
        {isSelected ? 'bg-blue-600/40 hover:bg-blue-600/50' : 'hover:bg-zinc-800'}
        {node.disabled ? 'cursor-not-allowed opacity-40' : ''}"
      style="padding-left: {paddingLeft}px"
      onclick={() => !node.disabled && handleRowClick(node)}
      role="button"
      tabindex="0"
    >
      {#if hasChildren}
        <button
          class="shrink-0 rounded p-0.5 hover:bg-zinc-700"
          onclick={(e) => toggleExpanded(node.id, e)}
        >
          {#if isExpanded}
            <ChevronDown class="h-3 w-3 text-zinc-500" />
          {:else}
            <ChevronRight class="h-3 w-3 text-zinc-500" />
          {/if}
        </button>
      {:else}
        <span class="w-4"></span>
      {/if}

      {#if IconComponent}
        <IconComponent class="h-4 w-4 shrink-0 {node.iconClass ?? 'text-zinc-400'}" />
      {:else if isExpanded}
        <FolderOpen class="h-4 w-4 shrink-0 text-yellow-500" />
      {:else}
        <Folder class="h-4 w-4 shrink-0 text-yellow-500" />
      {/if}

      <span class="truncate font-mono text-zinc-200">{node.name}</span>
    </div>

    {#if hasChildren && isExpanded}
      {#each node.children as child}
        {@render folderItem(child, depth + 1)}
      {/each}
    {/if}
  </div>
{/snippet}

<Dialog.Root bind:open>
  <Dialog.Content class="max-h-[80vh] max-w-sm border-zinc-700 bg-zinc-900">
    <Dialog.Header>
      <Dialog.Title>{title}</Dialog.Title>
      {#if description}
        <Dialog.Description class="text-zinc-400">
          {description}
        </Dialog.Description>
      {/if}
    </Dialog.Header>

    <div class="max-h-[50vh] overflow-y-auto py-2">
      {#if folders.length === 0}
        <div class="px-4 py-8 text-center text-sm text-zinc-500">No folders available</div>
      {:else}
        {#each folders as node}
          {@render folderItem(node, 0)}
        {/each}
      {/if}
    </div>

    <Dialog.Footer class="flex gap-2 border-t border-zinc-800 pt-4">
      <button
        class="flex-1 rounded bg-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-600"
        onclick={handleCancel}
      >
        Cancel
      </button>
      <button
        class="flex-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600"
        disabled={!selectedId}
        onclick={handleConfirm}
      >
        {confirmText}
      </button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
