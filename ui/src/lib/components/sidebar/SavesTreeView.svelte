<script lang="ts">
  import {
    FileJson,
    Trash2,
    Pencil,
    Download,
    Upload,
    Play,
    Link,
    Save,
    History,
    Folder,
    FolderOpen,
    FolderPlus,
    ChevronRight,
    ChevronDown,
    Move
  } from '@lucide/svelte/icons';
  import SearchBar from './SearchBar.svelte';
  import * as ContextMenu from '$lib/components/ui/context-menu';
  import LoadPatchDialog from '$lib/components/dialogs/LoadPatchDialog.svelte';
  import DeletePatchDialog from '$lib/components/dialogs/DeletePatchDialog.svelte';
  import FolderPickerDialog, { type FolderNode } from './FolderPickerDialog.svelte';
  import { toast } from 'svelte-sonner';
  import {
    isMobile,
    currentPatchName,
    savedPatches,
    savedFolders,
    addSavedPatch,
    addSavedFolder,
    removeSavedPatch,
    removeSavedFolder,
    renameSavedPatch,
    renameSavedFolder,
    moveSavedPatch,
    moveSavedFolder,
    getSaveBaseName,
    getSaveParentFolder
  } from '../../../stores/ui.store';
  import { type PatchSaveFormat } from '$lib/save-load/serialize-patch';
  import { migratePatch } from '$lib/migration';
  import { createAndCopyShareLink } from '$lib/save-load/share';
  import { deleteSearchParam } from '$lib/utils/search-params';

  let { onSavePatch }: { onSavePatch?: () => void } = $props();

  // Tree node type
  type TreeNode = {
    name: string;
    path: string;
    isFolder: boolean;
    children: TreeNode[];
  };

  // Build tree from flat patches and folders
  function buildTree(patches: string[], folders: string[]): TreeNode[] {
    const root: TreeNode[] = [];
    const nodeMap = new Map<string, TreeNode>();

    // Helper to ensure parent folders exist
    function ensureFolder(folderPath: string): TreeNode {
      if (nodeMap.has(folderPath)) {
        return nodeMap.get(folderPath)!;
      }

      const parts = folderPath.split('/');
      const name = parts[parts.length - 1];
      const parentPath = parts.slice(0, -1).join('/');

      const node: TreeNode = { name, path: folderPath, isFolder: true, children: [] };
      nodeMap.set(folderPath, node);

      if (parentPath) {
        const parent = ensureFolder(parentPath);
        parent.children.push(node);
      } else {
        root.push(node);
      }

      return node;
    }

    // Add explicit folders
    for (const f of folders) {
      ensureFolder(f);
    }

    // Add patches (creating implied folders as needed)
    for (const p of patches) {
      const parts = p.split('/');
      const name = parts[parts.length - 1];
      const parentPath = parts.slice(0, -1).join('/');

      const node: TreeNode = { name, path: p, isFolder: false, children: [] };

      if (parentPath) {
        const parent = ensureFolder(parentPath);
        parent.children.push(node);
      } else {
        root.push(node);
      }
    }

    // Sort: folders first, then alphabetically
    function sortNodes(nodes: TreeNode[]) {
      nodes.sort((a, b) => {
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      for (const n of nodes) {
        if (n.children.length > 0) sortNodes(n.children);
      }
    }
    sortNodes(root);

    return root;
  }

  // Reactive tree
  const tree = $derived(buildTree($savedPatches, $savedFolders));

  // Flatten tree for search
  function flattenTree(nodes: TreeNode[]): TreeNode[] {
    const result: TreeNode[] = [];
    for (const n of nodes) {
      result.push(n);
      if (n.children.length > 0) {
        result.push(...flattenTree(n.children));
      }
    }
    return result;
  }

  let searchQuery = $state('');

  // Filtered tree (for search)
  const filteredTree = $derived(() => {
    if (!searchQuery) return tree;
    const query = searchQuery.toLowerCase();
    const flat = flattenTree(tree);
    return flat.filter((n) => !n.isFolder && n.name.toLowerCase().includes(query));
  });

  // Expanded folders - persisted to localStorage
  function loadExpandedPaths(): Set<string> {
    if (typeof localStorage === 'undefined') return new Set();
    try {
      const saved = localStorage.getItem('patchies-saves-expanded');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  }

  let expandedPaths = $state(loadExpandedPaths());

  $effect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('patchies-saves-expanded', JSON.stringify([...expandedPaths]));
    }
  });

  function toggleExpanded(path: string, e: MouseEvent) {
    e.stopPropagation();
    if (expandedPaths.has(path)) {
      expandedPaths.delete(path);
    } else {
      expandedPaths.add(path);
    }
    expandedPaths = new Set(expandedPaths);
  }

  // Selection state
  let selectedPath = $state<string | null>(null);
  let selectedIsFolder = $state(false);

  // Renaming state
  let renamingPath = $state<string | null>(null);
  let renameInputValue = $state('');

  // New folder state
  let creatingFolderIn = $state<string | null>(null); // null = root, string = parent folder path
  let newFolderName = $state('');

  // Delete confirmation
  let showDeleteDialog = $state(false);
  let deleteTarget = $state<{ path: string; isFolder: boolean } | null>(null);

  // Load confirmation
  let showLoadDialog = $state(false);
  let patchToLoad = $state<string | null>(null);

  // Move dialog (mobile)
  let showMoveDialog = $state(false);
  let moveTarget = $state<{ path: string; isFolder: boolean } | null>(null);

  // Drag-drop state
  let draggedPath = $state<string | null>(null);
  let draggedIsFolder = $state(false);
  let dropTargetPath = $state<string | null>(null);

  // --- Actions ---

  function confirmLoad(patchPath: string) {
    patchToLoad = patchPath;
    showLoadDialog = true;
  }

  function loadPatch() {
    if (!patchToLoad) return;

    const patchData = localStorage.getItem(`patchies-patch-${patchToLoad}`);
    if (!patchData) {
      toast.error('Patch not found');
      patchToLoad = null;
      showLoadDialog = false;
      return;
    }

    try {
      const parsed: PatchSaveFormat = JSON.parse(patchData);
      const migrated = migratePatch(parsed) as PatchSaveFormat;
      localStorage.setItem('patchies-patch-autosave', JSON.stringify(migrated));
      currentPatchName.set(patchToLoad === 'autosave' ? null : patchToLoad);
      deleteSearchParam('id'); // Clear shared patch URL since we're loading a different patch
      window.location.reload();
    } catch (error) {
      console.error('Error loading patch:', error);
      toast.error('Failed to load patch');
    }

    patchToLoad = null;
    showLoadDialog = false;
  }

  function startRename(path: string, isFolder: boolean) {
    renamingPath = path;
    renameInputValue = getSaveBaseName(path);
  }

  function handleRenameKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      finishRename();
    } else if (event.key === 'Escape') {
      renamingPath = null;
    }
  }

  function finishRename() {
    if (!renamingPath || !renameInputValue.trim()) {
      renamingPath = null;
      return;
    }

    const newBaseName = renameInputValue.trim();
    const oldBaseName = getSaveBaseName(renamingPath);
    if (newBaseName === oldBaseName) {
      renamingPath = null;
      return;
    }

    const parentPath = getSaveParentFolder(renamingPath);
    const newPath = parentPath ? `${parentPath}/${newBaseName}` : newBaseName;

    // Check if name already exists
    if ($savedPatches.includes(newPath) || $savedFolders.includes(newPath)) {
      toast.error('An item with this name already exists');
      return;
    }

    const isFolder = $savedFolders.includes(renamingPath) || !$savedPatches.includes(renamingPath);

    try {
      if (isFolder) {
        renameSavedFolder(renamingPath, newPath);
      } else {
        // Get the patch data and move it
        const patchData = localStorage.getItem(`patchies-patch-${renamingPath}`);
        if (patchData) {
          localStorage.setItem(`patchies-patch-${newPath}`, patchData);
          localStorage.removeItem(`patchies-patch-${renamingPath}`);
        }
        renameSavedPatch(renamingPath, newPath);

        // Update current patch name if needed
        if ($currentPatchName === renamingPath) {
          currentPatchName.set(newPath);
        }
      }
      toast.success(`Renamed to "${newBaseName}"`);
    } catch (error) {
      console.error('Error renaming:', error);
      toast.error('Failed to rename');
    }

    renamingPath = null;
  }

  function confirmDelete(path: string, isFolder: boolean) {
    deleteTarget = { path, isFolder };
    showDeleteDialog = true;
  }

  function executeDelete() {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.isFolder) {
        removeSavedFolder(deleteTarget.path);
        toast.success(`Deleted folder "${getSaveBaseName(deleteTarget.path)}"`);
      } else {
        localStorage.removeItem(`patchies-patch-${deleteTarget.path}`);
        if ($currentPatchName === deleteTarget.path) {
          currentPatchName.set(null);
        }
        removeSavedPatch(deleteTarget.path);
        toast.success(`Deleted "${getSaveBaseName(deleteTarget.path)}"`);
      }
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete');
    }

    deleteTarget = null;
    showDeleteDialog = false;
    selectedPath = null;
  }

  function startNewFolder(parentPath: string | null) {
    creatingFolderIn = parentPath;
    newFolderName = '';
    if (parentPath) {
      expandedPaths.add(parentPath);
      expandedPaths = new Set(expandedPaths);
    }
  }

  function handleNewFolderKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      finishNewFolder();
    } else if (event.key === 'Escape') {
      creatingFolderIn = null;
    }
  }

  function finishNewFolder() {
    if (!newFolderName.trim()) {
      creatingFolderIn = null;
      return;
    }

    const name = newFolderName.trim();
    const path = creatingFolderIn ? `${creatingFolderIn}/${name}` : name;

    if ($savedFolders.includes(path) || $savedPatches.includes(path)) {
      toast.error('An item with this name already exists');
      return;
    }

    addSavedFolder(path);
    expandedPaths.add(path);
    expandedPaths = new Set(expandedPaths);
    toast.success(`Created folder "${name}"`);
    creatingFolderIn = null;
  }

  function exportPatch(patchPath: string) {
    const patchData = localStorage.getItem(`patchies-patch-${patchPath}`);
    if (!patchData) {
      toast.error('Patch not found');
      return;
    }

    try {
      const blob = new Blob([patchData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${getSaveBaseName(patchPath)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported "${getSaveBaseName(patchPath)}"`);
    } catch (error) {
      console.error('Error exporting patch:', error);
      toast.error('Failed to export patch');
    }
  }

  async function sharePatch(patchPath: string) {
    const patchData = localStorage.getItem(`patchies-patch-${patchPath}`);
    if (!patchData) {
      toast.error('Patch not found');
      return;
    }

    try {
      const parsed: PatchSaveFormat = JSON.parse(patchData);
      await createAndCopyShareLink(parsed.nodes, parsed.edges);
    } catch (error) {
      console.error('Error sharing patch:', error);
      toast.error('Failed to share patch');
    }
  }

  // --- Drag and Drop ---

  function handleDragStart(event: DragEvent, path: string, isFolder: boolean) {
    if (!event.dataTransfer) return;

    draggedPath = path;
    draggedIsFolder = isFolder;

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-patchies-save', JSON.stringify({ path, isFolder }));
    event.dataTransfer.setData('text/plain', path);
  }

  function handleDragEnd() {
    draggedPath = null;
    draggedIsFolder = false;
    dropTargetPath = null;
  }

  function handleDragOver(event: DragEvent, targetPath: string | null, targetIsFolder: boolean) {
    if (!draggedPath) return;
    if (!targetIsFolder && targetPath !== null) return; // Can only drop on folders or root

    // Prevent dropping on self or children
    if (draggedPath === targetPath) return;
    if (targetPath && targetPath.startsWith(draggedPath + '/')) return;

    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
    dropTargetPath = targetPath;
  }

  function handleDragLeave() {
    dropTargetPath = null;
  }

  function handleDrop(event: DragEvent, targetPath: string | null) {
    event.preventDefault();

    if (!draggedPath) return;

    const baseName = getSaveBaseName(draggedPath);
    const newPath = targetPath ? `${targetPath}/${baseName}` : baseName;

    if (newPath === draggedPath) {
      handleDragEnd();
      return;
    }

    // Check for conflicts
    if ($savedPatches.includes(newPath) || $savedFolders.includes(newPath)) {
      toast.error('An item with this name already exists in the target folder');
      handleDragEnd();
      return;
    }

    try {
      if (draggedIsFolder) {
        moveSavedFolder(draggedPath, newPath);
      } else {
        moveSavedPatch(draggedPath, newPath);
        if ($currentPatchName === draggedPath) {
          currentPatchName.set(newPath);
        }
      }

      // Auto-expand target folder
      if (targetPath) {
        expandedPaths.add(targetPath);
        expandedPaths = new Set(expandedPaths);
      }

      toast.success(`Moved to ${targetPath || 'root'}`);
    } catch (error) {
      console.error('Error moving:', error);
      toast.error('Failed to move');
    }

    handleDragEnd();
  }

  // --- Mobile Move ---

  function startMove(path: string, isFolder: boolean) {
    moveTarget = { path, isFolder };
    showMoveDialog = true;
  }

  // Build folder tree for picker
  const moveFolderTree = $derived.by((): FolderNode[] => {
    const rootNode: FolderNode = {
      id: '',
      name: 'Saves (root)',
      children: [],
      disabled: moveTarget ? getSaveParentFolder(moveTarget.path) === '' : false
    };

    function buildFolderNodes(nodes: TreeNode[], parentPath: string): FolderNode[] {
      return nodes
        .filter((n) => n.isFolder)
        .map((n) => ({
          id: n.path,
          name: n.name,
          children: buildFolderNodes(n.children, n.path),
          disabled: moveTarget
            ? n.path === moveTarget.path ||
              n.path.startsWith(moveTarget.path + '/') ||
              getSaveParentFolder(moveTarget.path) === n.path
            : false
        }));
    }

    rootNode.children = buildFolderNodes(tree, '');
    return [rootNode];
  });

  function handleMoveSelect(targetPath: string) {
    if (!moveTarget) return;

    const baseName = getSaveBaseName(moveTarget.path);
    const newPath = targetPath ? `${targetPath}/${baseName}` : baseName;

    if (newPath === moveTarget.path) {
      showMoveDialog = false;
      moveTarget = null;
      return;
    }

    if ($savedPatches.includes(newPath) || $savedFolders.includes(newPath)) {
      toast.error('An item with this name already exists in the target folder');
      return;
    }

    try {
      if (moveTarget.isFolder) {
        moveSavedFolder(moveTarget.path, newPath);
      } else {
        moveSavedPatch(moveTarget.path, newPath);
        if ($currentPatchName === moveTarget.path) {
          currentPatchName.set(newPath);
        }
      }

      if (targetPath) {
        expandedPaths.add(targetPath);
        expandedPaths = new Set(expandedPaths);
      }

      toast.success(`Moved to ${targetPath || 'root'}`);
    } catch (error) {
      console.error('Error moving:', error);
      toast.error('Failed to move');
    }

    showMoveDialog = false;
    moveTarget = null;
    selectedPath = null;
  }

  // --- Import ---

  let importInputRef = $state<HTMLInputElement | null>(null);

  function handleImportClick() {
    importInputRef?.click();
  }

  async function handleImportChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.nodes || !data.edges) {
        throw new Error('Invalid patch format');
      }

      let baseName = file.name.replace(/\.json$/i, '');
      let finalName = baseName;
      let counter = 1;
      while ($savedPatches.includes(finalName)) {
        finalName = `${baseName}-${counter}`;
        counter++;
      }

      localStorage.setItem(`patchies-patch-${finalName}`, text);
      addSavedPatch(finalName);
      toast.success(`Imported "${finalName}"`);
    } catch (err) {
      toast.error('Failed to import patch');
      console.error('Import error:', err);
    }

    input.value = '';
  }

  // --- Keyboard ---

  function handleTreeKeydown(event: KeyboardEvent) {
    if (!selectedPath) return;

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      confirmDelete(selectedPath, selectedIsFolder);
    }

    if (event.key === 'Escape') {
      selectedPath = null;
    }

    if (event.key === 'Enter' && selectedPath && !selectedIsFolder) {
      event.preventDefault();
      confirmLoad(selectedPath);
    }
  }
</script>

<!-- Hidden file input for import -->
<input
  bind:this={importInputRef}
  type="file"
  accept=".json"
  class="hidden"
  onchange={handleImportChange}
/>

{#snippet treeItem(node: TreeNode, depth: number)}
  {@const isExpanded = expandedPaths.has(node.path)}
  {@const isSelected = selectedPath === node.path}
  {@const isRenaming = renamingPath === node.path}
  {@const isAutosave = node.path === 'autosave'}
  {@const isActive = $currentPatchName === node.path}
  {@const isDropTarget = dropTargetPath === node.path}
  {@const paddingLeft = depth * 16 + 12}

  <ContextMenu.Root>
    <ContextMenu.Trigger class="block w-full">
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        class="group flex w-full cursor-pointer items-center gap-1.5 py-1.5 pr-3 text-left text-xs
          {isActive && !node.isFolder ? 'border-l-2 border-blue-500' : ''}
          {isSelected ? 'bg-blue-900/40 hover:bg-blue-900/50' : 'hover:bg-zinc-800'}
          {isDropTarget ? 'bg-blue-600/30 ring-1 ring-blue-500' : ''}"
        style="padding-left: {isActive && !node.isFolder ? paddingLeft - 2 : paddingLeft}px"
        onclick={() => {
          if (isRenaming) return;
          selectedPath = isSelected ? null : node.path;
          selectedIsFolder = node.isFolder;
        }}
        ondblclick={() => {
          if (isRenaming) return;
          if (node.isFolder) {
            toggleExpanded(node.path, new MouseEvent('click'));
          } else {
            confirmLoad(node.path);
          }
        }}
        draggable={!isRenaming}
        ondragstart={(e) => handleDragStart(e, node.path, node.isFolder)}
        ondragend={handleDragEnd}
        ondragover={(e) => handleDragOver(e, node.isFolder ? node.path : null, node.isFolder)}
        ondragleave={handleDragLeave}
        ondrop={(e) => node.isFolder && handleDrop(e, node.path)}
        role="treeitem"
        aria-selected={isSelected}
        tabindex="0"
      >
        {#if node.isFolder}
          <button
            class="shrink-0 rounded p-0.5 hover:bg-zinc-700"
            onclick={(e) => toggleExpanded(node.path, e)}
          >
            {#if isExpanded}
              <ChevronDown class="h-3 w-3 text-zinc-500" />
            {:else}
              <ChevronRight class="h-3 w-3 text-zinc-500" />
            {/if}
          </button>
          {#if isExpanded}
            <FolderOpen class="h-4 w-4 shrink-0 text-yellow-500" />
          {:else}
            <Folder class="h-4 w-4 shrink-0 text-yellow-500" />
          {/if}
        {:else if isAutosave}
          <span class="w-4"></span>
          <History class="h-4 w-4 shrink-0 text-emerald-400" />
        {:else}
          <span class="w-4"></span>
          <FileJson class="h-4 w-4 shrink-0 text-blue-400" />
        {/if}

        {#if isRenaming}
          <!-- svelte-ignore a11y_autofocus -->
          <input
            type="text"
            class="flex-1 truncate rounded bg-transparent px-1 font-mono text-zinc-300 ring-1 ring-blue-500 outline-none"
            bind:value={renameInputValue}
            onkeydown={handleRenameKeydown}
            onblur={finishRename}
            onclick={(e) => e.stopPropagation()}
            autofocus
          />
        {:else}
          <span class="flex-1 truncate font-mono text-zinc-300" title={node.path}>
            {node.name}
          </span>
        {/if}

        <!-- Desktop hover actions -->
        {#if !$isMobile && !isRenaming}
          <div class="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
            {#if !node.isFolder}
              <button
                class="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-blue-400"
                onclick={(e) => {
                  e.stopPropagation();
                  confirmLoad(node.path);
                }}
                title="Load patch"
              >
                <Play class="h-3.5 w-3.5" />
              </button>
            {:else}
              <button
                class="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                onclick={(e) => {
                  e.stopPropagation();
                  startNewFolder(node.path);
                }}
                title="New subfolder"
              >
                <FolderPlus class="h-3.5 w-3.5" />
              </button>
            {/if}
            <button
              class="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
              onclick={(e) => {
                e.stopPropagation();
                startRename(node.path, node.isFolder);
              }}
              title="Rename"
            >
              <Pencil class="h-3.5 w-3.5" />
            </button>
            <button
              class="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-red-400"
              onclick={(e) => {
                e.stopPropagation();
                confirmDelete(node.path, node.isFolder);
              }}
              title="Delete"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </button>
          </div>
        {/if}
      </div>
    </ContextMenu.Trigger>

    <ContextMenu.Content class="w-48">
      {#if !node.isFolder}
        <ContextMenu.Item onclick={() => confirmLoad(node.path)}>
          <Play class="mr-2 h-4 w-4" />
          Load
        </ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item onclick={() => sharePatch(node.path)}>
          <Link class="mr-2 h-4 w-4" />
          Share Link
        </ContextMenu.Item>
        <ContextMenu.Item onclick={() => exportPatch(node.path)}>
          <Download class="mr-2 h-4 w-4" />
          Export as JSON
        </ContextMenu.Item>
        <ContextMenu.Separator />
      {:else}
        <ContextMenu.Item onclick={() => startNewFolder(node.path)}>
          <FolderPlus class="mr-2 h-4 w-4" />
          New Subfolder
        </ContextMenu.Item>
        <ContextMenu.Separator />
      {/if}
      <ContextMenu.Item onclick={() => startMove(node.path, node.isFolder)}>
        <Move class="mr-2 h-4 w-4" />
        Move to...
      </ContextMenu.Item>
      <ContextMenu.Item onclick={() => startRename(node.path, node.isFolder)}>
        <Pencil class="mr-2 h-4 w-4" />
        Rename
      </ContextMenu.Item>
      <ContextMenu.Separator />
      <ContextMenu.Item
        class="text-red-400 focus:text-red-400"
        onclick={() => confirmDelete(node.path, node.isFolder)}
      >
        <Trash2 class="mr-2 h-4 w-4" />
        Delete{node.isFolder ? ' Folder' : ''}
      </ContextMenu.Item>
    </ContextMenu.Content>
  </ContextMenu.Root>

  <!-- New folder input (inside this folder) -->
  {#if creatingFolderIn === node.path && node.isFolder}
    <div class="flex items-center gap-1.5 py-1.5 pr-3" style="padding-left: {paddingLeft + 20}px">
      <Folder class="h-4 w-4 shrink-0 text-yellow-500" />
      <!-- svelte-ignore a11y_autofocus -->
      <input
        type="text"
        class="flex-1 rounded bg-transparent px-1 font-mono text-xs text-zinc-300 ring-1 ring-blue-500 outline-none"
        bind:value={newFolderName}
        onkeydown={handleNewFolderKeydown}
        onblur={() => (creatingFolderIn = null)}
        placeholder="folder name"
        autofocus
      />
    </div>
  {/if}

  <!-- Children -->
  {#if node.isFolder && isExpanded}
    {#each node.children as child (child.path)}
      {@render treeItem(child, depth + 1)}
    {/each}
  {/if}
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="flex h-full flex-col outline-none"
  role="tree"
  tabindex="0"
  onkeydown={handleTreeKeydown}
  ondragover={(e) => handleDragOver(e, null, true)}
  ondragleave={handleDragLeave}
  ondrop={(e) => handleDrop(e, null)}
>
  <!-- Search bar -->
  <SearchBar bind:value={searchQuery} placeholder="Search saves..." />

  <!-- Tree content -->
  <div
    class="flex-1 overflow-y-auto py-1 {$isMobile && selectedPath
      ? 'pb-14'
      : ''} {dropTargetPath === null && draggedPath ? 'bg-blue-600/10' : ''}"
  >
    {#if searchQuery}
      <!-- Flat search results -->
      {@const results = filteredTree()}
      {#if results.length === 0}
        <div class="px-4 py-8 text-center text-xs text-zinc-500">
          No patches matching "{searchQuery}"
        </div>
      {:else}
        {#each results as node (node.path)}
          {@render treeItem(node, 0)}
        {/each}
      {/if}
    {:else if tree.length === 0 && creatingFolderIn === null}
      <div class="px-4 py-8 text-center text-xs text-zinc-500">
        No saved patches yet.
        <br />
        <span class="text-zinc-600">Use Cmd+S to save your first patch.</span>
      </div>
    {:else}
      <!-- New folder input at root -->
      {#if creatingFolderIn === null && newFolderName !== undefined && creatingFolderIn !== undefined}
        <!-- Check if we're creating at root (creatingFolderIn was set to null explicitly) -->
      {/if}

      {#each tree as node (node.path)}
        {@render treeItem(node, 0)}
      {/each}

      <!-- Root-level new folder input -->
      {#if creatingFolderIn === ''}
        <div class="flex items-center gap-1.5 py-1.5 pr-3 pl-3">
          <span class="w-4"></span>
          <Folder class="h-4 w-4 shrink-0 text-yellow-500" />
          <!-- svelte-ignore a11y_autofocus -->
          <input
            type="text"
            class="flex-1 rounded bg-transparent px-1 font-mono text-xs text-zinc-300 ring-1 ring-blue-500 outline-none"
            bind:value={newFolderName}
            onkeydown={handleNewFolderKeydown}
            onblur={() => (creatingFolderIn = null)}
            placeholder="folder name"
            autofocus
          />
        </div>
      {/if}
    {/if}
  </div>

  <!-- Footer actions -->
  <div
    class="sticky bottom-0 flex items-center gap-1 border-t border-zinc-800 bg-zinc-950 px-2 pt-1.5"
    style="padding-bottom: calc(0.375rem + env(safe-area-inset-bottom, 0px))"
  >
    <button
      class="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
      onclick={() => startNewFolder('')}
      title="New Folder"
    >
      <FolderPlus class="h-3.5 w-3.5" />
      <span>Folder</span>
    </button>
    <button
      class="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
      onclick={() => onSavePatch?.()}
      title="Save Patch As"
    >
      <Save class="h-3.5 w-3.5" />
      <span>Save As</span>
    </button>
    <button
      class="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
      onclick={handleImportClick}
      title="Import Patch"
    >
      <Upload class="h-3.5 w-3.5" />
      <span>Import</span>
    </button>
  </div>
</div>

<!-- Mobile floating toolbar -->
{#if $isMobile && selectedPath}
  <div
    class="fixed right-0 bottom-0 left-0 border-t border-zinc-800 bg-zinc-900/95 px-4 pt-2 backdrop-blur-sm"
    style="padding-bottom: calc(0.5rem + env(safe-area-inset-bottom, 0px))"
  >
    <div class="flex items-center justify-center gap-2">
      <span class="mr-2 max-w-24 truncate font-mono text-xs text-zinc-400">
        {getSaveBaseName(selectedPath)}
      </span>

      {#if !selectedIsFolder}
        <button
          class="flex cursor-pointer items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          onclick={() => confirmLoad(selectedPath!)}
          title="Load"
        >
          <Play class="h-3.5 w-3.5" />
          <span>Load</span>
        </button>

        <button
          class="flex cursor-pointer items-center gap-1.5 rounded bg-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-600"
          onclick={() => exportPatch(selectedPath!)}
          title="Export"
        >
          <Download class="h-3.5 w-3.5" />
        </button>
      {/if}

      <button
        class="flex cursor-pointer items-center gap-1.5 rounded bg-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-600"
        onclick={() => startMove(selectedPath!, selectedIsFolder)}
        title="Move"
      >
        <Move class="h-3.5 w-3.5" />
      </button>

      <button
        class="flex cursor-pointer items-center gap-1.5 rounded bg-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-600"
        onclick={() => {
          startRename(selectedPath!, selectedIsFolder);
          selectedPath = null;
        }}
        title="Rename"
      >
        <Pencil class="h-3.5 w-3.5" />
      </button>

      <button
        class="flex cursor-pointer items-center gap-1.5 rounded bg-red-600/80 px-3 py-1.5 text-xs text-white hover:bg-red-600"
        onclick={() => confirmDelete(selectedPath!, selectedIsFolder)}
        title="Delete"
      >
        <Trash2 class="h-3.5 w-3.5" />
      </button>

      <button
        class="ml-auto text-xs text-zinc-500 hover:text-zinc-300"
        onclick={() => (selectedPath = null)}
      >
        Cancel
      </button>
    </div>
  </div>
{/if}

<LoadPatchDialog bind:open={showLoadDialog} patchName={patchToLoad} onConfirm={loadPatch} />

<DeletePatchDialog
  bind:open={showDeleteDialog}
  patchName={deleteTarget?.path ?? null}
  onConfirm={executeDelete}
/>

<FolderPickerDialog
  bind:open={showMoveDialog}
  title="Move to folder"
  description="Select a destination folder"
  confirmText="Move"
  folders={moveFolderTree}
  onSelect={handleMoveSelect}
/>
