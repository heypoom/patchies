<script lang="ts">
  import {
    ChevronRight,
    ChevronDown,
    File,
    FileCode,
    FileText,
    FilePlay,
    Folder,
    FolderOpen,
    FolderPlus,
    FolderSymlink,
    Image,
    Music,
    User,
    Box,
    Upload,
    Link,
    RefreshCw,
    Trash2,
    Pencil,
    Copy,
    Plus,
    FolderInput,
    Ellipsis
  } from '@lucide/svelte/icons';
  import { VirtualFilesystem, getLocalProvider, guessMimeType } from '$lib/vfs';
  import { parseVFSPath, isVFSFolder, isLocalFolder, type VFSEntry } from '$lib/vfs/types';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import * as ContextMenu from '$lib/components/ui/context-menu';
  import * as Popover from '$lib/components/ui/popover';
  import { toast } from 'svelte-sonner';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import { isMobile, isSidebarOpen } from '../../../stores/ui.store';
  import FolderPickerDialog, { type FolderNode } from './FolderPickerDialog.svelte';

  interface TreeNode {
    name: string;
    path?: string;
    entry?: VFSEntry;
    children?: Map<string, TreeNode>;
    isExpanded?: boolean;
  }

  const vfs = VirtualFilesystem.getInstance();
  const eventBus = PatchiesEventBus.getInstance();

  // Reactive store of VFS entries
  const vfsEntries = vfs.entries$;

  // Reactive store of paths needing permission re-grant
  const pendingPermissions = vfs.pendingPermissions$;

  // Load expanded paths from localStorage, defaulting to user:// and obj://
  function loadExpandedPaths(): Set<string> {
    if (typeof window === 'undefined') return new Set(['user://', 'obj://']);
    try {
      const saved = localStorage.getItem('patchies-file-tree-expanded');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch {}
    return new Set(['user://', 'obj://']);
  }

  let expandedPaths = $state(loadExpandedPaths());

  // Persist expanded paths changes
  $effect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('patchies-file-tree-expanded', JSON.stringify([...expandedPaths]));
    }
  });
  let selectedPaths = $state(new Set<string>());
  let dropTargetPath = $state<string | null>(null);

  // Mobile-specific state
  let showMoveDialog = $state(false);
  let mobileMoreOpen = $state(false);

  // Get the currently selected file path (for mobile toolbar)
  const selectedFilePath = $derived.by(() => {
    if (selectedPaths.size !== 1) return null;
    const path = [...selectedPaths][0];
    const entry = vfs.getEntry(path);
    // Only return if it's a file (not a folder)
    if (entry && !isVFSFolder(entry)) return path;
    return null;
  });

  // Get selected file entry for display
  const selectedFileEntry = $derived.by(() => {
    if (!selectedFilePath) return null;
    return vfs.getEntry(selectedFilePath);
  });

  // Build folder tree for move dialog
  const moveFolderTree = $derived.by((): FolderNode[] => {
    const entries = $vfsEntries;

    // Collect all folder paths
    const folderPaths = new Set<string>();
    folderPaths.add('user://');

    for (const [path, entry] of entries) {
      if (isVFSFolder(entry) && !isLocalFolder(entry)) {
        folderPaths.add(path);
      }
      // Also add parent paths of all files as potential folders
      const parsed = parseVFSPath(path);
      if (parsed && parsed.namespace === 'user' && parsed.segments.length > 1) {
        for (let i = 1; i < parsed.segments.length; i++) {
          const parentPath = `user://${parsed.segments.slice(0, i).join('/')}`;
          folderPaths.add(parentPath);
        }
      }
    }

    // Build tree structure
    function buildChildren(parentPath: string): FolderNode[] {
      const children: FolderNode[] = [];
      const prefix = parentPath === 'user://' ? 'user://' : `${parentPath}/`;

      for (const folderPath of folderPaths) {
        if (!folderPath.startsWith(prefix) || folderPath === parentPath) continue;

        // Check if this is a direct child
        const relativePath = folderPath.slice(prefix.length);
        if (!relativePath.includes('/')) {
          // Check if this folder is the current file's parent (disable it)
          const isCurrentParent = !!(
            selectedFilePath &&
            selectedFilePath.startsWith(folderPath + '/') &&
            !selectedFilePath.slice(folderPath.length + 1).includes('/')
          );

          children.push({
            id: folderPath,
            name: relativePath,
            children: buildChildren(folderPath),
            disabled: isCurrentParent
          });
        }
      }

      return children.sort((a, b) => a.name.localeCompare(b.name));
    }

    return [
      {
        id: 'user://',
        name: 'user',
        icon: User,
        iconClass: 'text-yellow-400',
        children: buildChildren('user://')
      }
    ];
  });

  // Handle insert to canvas (mobile)
  function handleInsertToCanvas() {
    if (!selectedFilePath) return;
    eventBus.dispatch({
      type: 'insertVfsFileToCanvas',
      vfsPath: selectedFilePath
    });
    selectedPaths = new Set();
    $isSidebarOpen = false;
    toast.success('Added to canvas');
  }

  // Handle move file
  async function handleMoveFile(targetFolder: string) {
    if (!selectedFilePath) return;
    await moveVfsFile(selectedFilePath, targetFolder);
    selectedPaths = new Set();
  }

  function toggleSelected(path: string) {
    if (selectedPaths.has(path)) {
      selectedPaths = new Set();
    } else {
      selectedPaths = new Set([path]);
    }
  }

  async function deleteSelectedFiles() {
    if (selectedPaths.size === 0) return;

    const localProvider = getLocalProvider();

    for (const path of selectedPaths) {
      // If it's a folder, also delete all children
      const allPaths = vfs.list();
      const pathsToDelete = allPaths.filter(
        (p) => p === path || p.startsWith(path.endsWith('/') ? path : path + '/')
      );

      for (const pathToDelete of pathsToDelete) {
        // Remove from VFS in-memory entries
        vfs.remove(pathToDelete);

        // Clean up persisted data (handle + file data from IndexedDB)
        if (localProvider) {
          await localProvider.remove(pathToDelete);
        }
      }
    }

    selectedPaths = new Set();
  }

  function handleKeydown(event: KeyboardEvent) {
    // Don't intercept if user is typing in an input
    if (event.target instanceof HTMLInputElement) return;

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      deleteSelectedFiles();
    }
  }

  function handleDragStart(event: DragEvent, node: TreeNode) {
    if (!node.path) return;

    event.dataTransfer?.setData('application/x-vfs-path', node.path);
    event.dataTransfer?.setData('text/plain', node.path);

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copyMove';
    }
  }

  function handleLinkedFileDragStart(event: DragEvent, linkedFolderPath: string, fileName: string) {
    // Construct the VFS path for the file within the linked folder
    const vfsPath = `${linkedFolderPath}/${fileName}`;

    event.dataTransfer?.setData('application/x-vfs-path', vfsPath);
    event.dataTransfer?.setData('text/plain', vfsPath);

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
    }
  }

  // Build tree structure from VFS entries
  const tree = $derived.by(() => {
    const entries = $vfsEntries;

    const root: TreeNode = {
      name: 'root',
      children: new Map()
    };

    // Create namespace roots
    const userRoot: TreeNode = { name: 'User', path: 'user://', children: new Map() };
    const objRoot: TreeNode = { name: 'objects', path: 'obj://', children: new Map() };

    for (const [path, entry] of entries) {
      const parsed = parseVFSPath(path);
      if (!parsed) continue;

      const targetRoot = parsed.namespace === 'user' ? userRoot : objRoot;
      let current = targetRoot;

      // Build nested structure
      for (let i = 0; i < parsed.segments.length; i++) {
        const segment = parsed.segments[i];
        const isLast = i === parsed.segments.length - 1;

        if (!current.children) {
          current.children = new Map();
        }

        if (!current.children.has(segment)) {
          const nodePath = `${parsed.namespace === 'user' ? 'user://' : 'obj://'}${parsed.segments.slice(0, i + 1).join('/')}`;
          const isFolder = isLast && isVFSFolder(entry);
          current.children.set(segment, {
            name: segment,
            path: nodePath,
            // Folders always have children map (even if empty), files don't
            children: isLast && !isFolder ? undefined : new Map(),
            entry: isLast ? entry : undefined
          });
        } else if (isLast) {
          // Update existing node with entry info (in case folder was created before files added)
          const existingNode = current.children.get(segment)!;
          existingNode.entry = entry;
        }

        current = current.children.get(segment)!;
      }
    }

    // Always show user namespace (so users can upload/create folders)
    root.children!.set('user', userRoot);

    // Only add objects namespace if it has children
    if (objRoot.children && objRoot.children.size > 0) {
      root.children!.set('objects', objRoot);
    }

    return root;
  });

  function toggleExpanded(path: string) {
    if (expandedPaths.has(path)) {
      expandedPaths.delete(path);
    } else {
      expandedPaths.add(path);
    }
    expandedPaths = new Set(expandedPaths);
  }

  function getSortedChildren(node: TreeNode): TreeNode[] {
    if (!node.children) return [];

    return [...node.children.values()].sort((a, b) => {
      // Folders come before files
      const aIsFolder = a.children !== undefined;
      const bIsFolder = b.children !== undefined;
      if (aIsFolder && !bIsFolder) return -1;
      if (!aIsFolder && bIsFolder) return 1;

      // Then alphabetical
      return a.name.localeCompare(b.name);
    });
  }

  function getFileIcon(mimeType?: string) {
    if (!mimeType) return { icon: File, color: 'text-zinc-400' };

    if (mimeType.startsWith('image/')) {
      return { icon: Image, color: 'text-green-400' };
    }

    if (mimeType.startsWith('video/')) {
      return { icon: FilePlay, color: 'text-pink-400' };
    }

    if (mimeType.startsWith('audio/')) {
      return { icon: Music, color: 'text-purple-400' };
    }

    if (
      mimeType === 'application/javascript' ||
      mimeType === 'text/javascript' ||
      mimeType === 'application/x-javascript'
    ) {
      return { icon: FileCode, color: 'text-yellow-400' };
    }

    if (mimeType.startsWith('text/') || mimeType === 'application/json') {
      return { icon: FileText, color: 'text-blue-400' };
    }

    return { icon: File, color: 'text-zinc-400' };
  }

  // Check if a path is within the drop target folder
  function isInDropTarget(nodePath: string | undefined): boolean {
    if (!dropTargetPath || !nodePath) return false;
    return (
      nodePath === dropTargetPath || nodePath.startsWith(dropTargetPath.replace(/\/$/, '') + '/')
    );
  }

  function handleFolderDragOver(event: DragEvent, folderPath: string) {
    // Only allow drops into user:// or obj:// namespace
    if (!folderPath.startsWith('user://') && !folderPath.startsWith('obj://')) return;

    const hasFiles = event.dataTransfer?.types.includes('Files');
    const hasVfsPath = event.dataTransfer?.types.includes('application/x-vfs-path');

    // Accept external file drops or internal VFS moves
    if (hasFiles || hasVfsPath) {
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = hasVfsPath ? 'move' : 'copy';
      }
      dropTargetPath = folderPath;
    }
  }

  function handleTreeDragOver(event: DragEvent) {
    // Fallback for empty areas - only if not over a folder
    const hasFiles = event.dataTransfer?.types.includes('Files');
    const hasVfsPath = event.dataTransfer?.types.includes('application/x-vfs-path');

    if (hasFiles || hasVfsPath) {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = hasVfsPath ? 'move' : 'copy';
      }
      // Only set to user:// if we're not already targeting a folder
      if (dropTargetPath === null) {
        dropTargetPath = 'user://';
      }
    }
  }

  function handleFolderDragLeave(event: DragEvent) {
    // Only clear if leaving the tree entirely
    const relatedTarget = event.relatedTarget as HTMLElement | null;
    if (!relatedTarget?.closest('[role="tree"]')) {
      dropTargetPath = null;
    }
  }

  async function handleFolderDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    const targetFolder = dropTargetPath;
    dropTargetPath = null;

    // Check for internal VFS move first
    const vfsPath = event.dataTransfer?.getData('application/x-vfs-path');
    if (vfsPath && targetFolder) {
      await moveVfsFile(vfsPath, targetFolder);
      return;
    }

    // Handle external file drops
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    // Store each dropped file in VFS with the target folder
    for (const file of Array.from(files)) {
      await vfs.storeFile(file, undefined, targetFolder ?? undefined);
    }
  }

  async function moveVfsFile(oldPath: string, targetFolder: string) {
    const parsed = parseVFSPath(oldPath);
    if (!parsed) return;

    // Get the entry to access the real filename
    const rootEntry = vfs.getEntry(oldPath);
    // Use entry.filename (the real name) or fall back to path segment
    const filename = rootEntry?.filename || parsed.segments[parsed.segments.length - 1];

    // Construct new path in target folder
    const targetParsed = parseVFSPath(targetFolder);
    if (!targetParsed) return;

    // Build new path: targetFolder + filename
    const newBasePath = targetFolder.endsWith('/')
      ? `${targetFolder}${filename}`
      : `${targetFolder}/${filename}`;

    // Don't move if it's the same location
    if (oldPath === newBasePath) return;

    // Check if moving to a child of itself (invalid)
    const oldPathPrefix = oldPath.endsWith('/') ? oldPath : oldPath + '/';
    if (newBasePath.startsWith(oldPathPrefix)) {
      toast.error("Can't move a folder into itself");
      return;
    }

    // Get all paths that need to be moved (the item and all its children)
    const allPaths = vfs.list();
    const pathsToMove = allPaths.filter((p) => p === oldPath || p.startsWith(oldPathPrefix));

    const localProvider = getLocalProvider();

    // Move each path
    for (const pathToMove of pathsToMove) {
      const entry = vfs.getEntry(pathToMove);
      if (!entry) continue;

      // Calculate new path by replacing the old base with the new base
      const relativePath = pathToMove === oldPath ? '' : pathToMove.slice(oldPath.length);
      const newPath = newBasePath + relativePath;

      // Move in VFS - preserve the original filename from the entry
      vfs.registerEntry(newPath, entry);
      vfs.remove(pathToMove);

      // Move in LocalProvider
      if (localProvider) {
        await localProvider.rename(pathToMove, newPath);
      }

      // Dispatch event to update vfsPath in nodes
      eventBus.dispatch({
        type: 'vfsPathRenamed',
        oldPath: pathToMove,
        newPath
      });
    }

    // Update selection if moved item was selected
    if (selectedPaths.has(oldPath)) {
      selectedPaths.delete(oldPath);
      selectedPaths.add(newBasePath);
      selectedPaths = new Set(selectedPaths);
    }
  }

  // Hidden file input for upload
  let fileInputRef: HTMLInputElement | null = $state(null);
  let pendingUploadFolder: string | null = $state(null);

  function handleUploadClick(folderPath: string, event: MouseEvent) {
    event.stopPropagation();
    pendingUploadFolder = folderPath;
    fileInputRef?.click();
  }

  async function handleFileInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      await vfs.storeFile(file, undefined, pendingUploadFolder ?? undefined);
    }

    // Reset input so same file can be selected again
    input.value = '';
    pendingUploadFolder = null;
  }

  // URL input state
  let showUrlInput = $state<string | null>(null);
  let urlInputValue = $state('');

  function handleAddUrlClick(folderPath: string, event: MouseEvent) {
    event.stopPropagation();
    showUrlInput = folderPath;
    urlInputValue = '';
  }

  async function handleUrlSubmit(event: KeyboardEvent) {
    if (event.key === 'Enter' && urlInputValue.trim()) {
      event.preventDefault();
      // For now, registerUrl doesn't support target folder, so we just register at root
      // TODO: Add folder support to registerUrl
      await vfs.registerUrl(urlInputValue.trim());
      showUrlInput = null;
      urlInputValue = '';
    } else if (event.key === 'Escape') {
      showUrlInput = null;
      urlInputValue = '';
    }
  }

  // Create folder state
  let showFolderInput = $state<string | null>(null);
  let folderInputValue = $state('');

  function handleCreateFolderClick(folderPath: string, event: MouseEvent) {
    event.stopPropagation();
    showFolderInput = folderPath;
    folderInputValue = '';
  }

  function handleFolderInputSubmit(event: KeyboardEvent) {
    if (event.key === 'Enter' && folderInputValue.trim()) {
      event.preventDefault();
      const parentPath = showFolderInput;
      if (parentPath) {
        // Create the folder in VFS
        const newFolderPath = vfs.createFolder(parentPath, folderInputValue.trim());
        // Expand parent and the new folder
        expandedPaths.add(parentPath);
        expandedPaths.add(newFolderPath);
        expandedPaths = new Set(expandedPaths);
      }
      showFolderInput = null;
      folderInputValue = '';
    } else if (event.key === 'Escape') {
      showFolderInput = null;
      folderInputValue = '';
    }
  }

  // Rename state
  let renamingPath = $state<string | null>(null);
  let renameInputValue = $state('');

  function handleRenameClick(path: string, currentName: string) {
    renamingPath = path;
    renameInputValue = currentName;
  }

  async function handleRenameSubmit(event: KeyboardEvent) {
    if (event.key === 'Enter' && renameInputValue.trim() && renamingPath) {
      event.preventDefault();
      const newName = renameInputValue.trim();
      const oldPath = renamingPath;

      // Get the parent path and construct new path
      const parsed = parseVFSPath(oldPath);
      if (parsed) {
        const parentSegments = parsed.segments.slice(0, -1);
        const newPath =
          parentSegments.length > 0
            ? `${parsed.namespace}://${parentSegments.join('/')}/${newName}`
            : `${parsed.namespace}://${newName}`;

        // Get entry, register at new path, remove old path
        const entry = vfs.getEntry(oldPath);
        if (entry) {
          // Update the filename in the entry
          const updatedEntry = { ...entry, filename: newName };
          vfs.registerEntry(newPath, updatedEntry);
          vfs.remove(oldPath);

          // Also rename in LocalProvider to persist the change
          const localProvider = getLocalProvider();
          if (localProvider) {
            await localProvider.rename(oldPath, newPath);
          }

          // Dispatch event to update vfsPath in nodes
          eventBus.dispatch({ type: 'vfsPathRenamed', oldPath, newPath });

          // Update selection if renamed item was selected
          if (selectedPaths.has(oldPath)) {
            selectedPaths.delete(oldPath);
            selectedPaths.add(newPath);
            selectedPaths = new Set(selectedPaths);
          }
        }
      }

      renamingPath = null;
      renameInputValue = '';
    } else if (event.key === 'Escape') {
      renamingPath = null;
      renameInputValue = '';
    }
  }

  async function handleCopyPath(path: string) {
    await navigator.clipboard.writeText(path);
    toast.success('Path copied to clipboard');
  }

  async function handleDeleteFromContextMenu(path: string) {
    const localProvider = getLocalProvider();

    // If it's a folder, also delete all children
    const allPaths = vfs.list();
    const pathsToDelete = allPaths.filter(
      (p) => p === path || p.startsWith(path.endsWith('/') ? path : path + '/')
    );

    for (const pathToDelete of pathsToDelete) {
      vfs.remove(pathToDelete);
      if (localProvider) {
        await localProvider.remove(pathToDelete);
      }
    }

    selectedPaths = new Set();
  }

  // Check if a path or any of its children need permission re-grant
  function needsReselect(nodePath: string | undefined): boolean {
    if (!nodePath) return false;
    // Check if this exact path needs permission
    if ($pendingPermissions.has(nodePath)) return true;
    // Check if any child path needs permission (for folders)
    for (const pending of $pendingPermissions) {
      if (pending.startsWith(nodePath.replace(/\/$/, '') + '/')) return true;
    }
    return false;
  }

  // Hidden file input for reselect
  let reselectInputRef: HTMLInputElement | null = $state(null);
  let pendingReselectPath: string | null = $state(null);

  async function handleReselectClick(path: string, event: MouseEvent) {
    event.stopPropagation();

    // Get original entry to determine mime type for file picker filter
    const entry = vfs.getEntry(path);

    // Try to use showOpenFilePicker for handle support (Chrome/Edge)
    if ('showOpenFilePicker' in window) {
      try {
        // @ts-expect-error - showOpenFilePicker is not typed
        const [handle] = await window.showOpenFilePicker({
          types: entry?.mimeType?.startsWith('image/')
            ? [{ description: 'Images', accept: { 'image/*': [] } }]
            : undefined,
          multiple: false
        });

        const file = await handle.getFile();
        await vfs.replaceFile(path, file, handle);
        return;
      } catch (err) {
        // User cancelled or error - fall back to input
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }

    // Fallback: use traditional file input
    pendingReselectPath = path;
    reselectInputRef?.click();
  }

  async function handleReselectFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0 || !pendingReselectPath) return;

    const file = files[0];

    // Replace the file at the same path (no handle available from file input)
    await vfs.replaceFile(pendingReselectPath, file);

    // Reset
    input.value = '';
    pendingReselectPath = null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Local Folder Linking
  // ─────────────────────────────────────────────────────────────────

  // Check if browser supports directory picker (Chrome/Edge only)
  const supportsDirectoryPicker = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  // Cache for local folder contents (path -> contents)
  // The path key can be either:
  // - A VFS path for the root linked folder (e.g., "user://my-folder")
  // - A VFS-style path for subdirectories (e.g., "user://my-folder/subdir")
  let localFolderContents = $state(
    new Map<string, Array<{ name: string; kind: 'file' | 'directory'; handle: FileSystemHandle }>>()
  );

  // Cache for directory handles within linked folders (for expanding subdirs)
  let subdirHandleCache = $state(new Map<string, FileSystemDirectoryHandle>());

  async function handleLinkFolderClick(event: MouseEvent) {
    event.stopPropagation();

    if (!supportsDirectoryPicker) {
      return;
    }

    try {
      // @ts-expect-error - showDirectoryPicker is not typed
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      const path = await vfs.linkLocalFolder(handle);

      // Expand the new folder
      expandedPaths.add('user://');
      expandedPaths.add(path);
      expandedPaths = new Set(expandedPaths);

      // Load its contents
      await loadLocalFolderContents(path);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Failed to link folder:', err);
      }
    }
  }

  async function loadLocalFolderContents(path: string, handle?: FileSystemDirectoryHandle) {
    const provider = getLocalProvider();
    if (!provider) return;

    try {
      let contents: Array<{ name: string; kind: 'file' | 'directory'; handle: FileSystemHandle }>;

      if (handle) {
        // Use the provided handle directly (for subdirectories)
        contents = await provider.listHandleContents(handle);
      } else {
        // Use the VFS path to get root linked folder contents
        contents = await provider.listDirContents(path);
      }

      // Cache directory handles for subdirectories
      for (const item of contents) {
        if (item.kind === 'directory') {
          const subdirPath = `${path}/${item.name}`;
          subdirHandleCache.set(subdirPath, item.handle as FileSystemDirectoryHandle);
        }
      }
      subdirHandleCache = new Map(subdirHandleCache);

      localFolderContents.set(path, contents);
      localFolderContents = new Map(localFolderContents);
    } catch (err) {
      console.error('Failed to load local folder contents:', err);
    }
  }

  // Load contents when a local folder is expanded (always refresh to pick up filesystem changes)
  async function handleLocalFolderExpand(path: string) {
    await loadLocalFolderContents(path);
  }

  async function handleRefreshLinkedFolder(path: string, event: MouseEvent) {
    event.stopPropagation();
    await loadLocalFolderContents(path);
  }

  async function handleRelinkFolderClick(path: string, event: MouseEvent) {
    event.stopPropagation();

    if (!supportsDirectoryPicker) {
      return;
    }

    try {
      // @ts-expect-error - showDirectoryPicker is not typed
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      await vfs.relinkLocalFolder(path, handle);

      // Load the folder contents
      await loadLocalFolderContents(path);

      // Expand the folder
      expandedPaths.add(path);
      expandedPaths = new Set(expandedPaths);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Failed to relink folder:', err);
      }
    }
  }

  async function handleSubdirClick(subdirPath: string) {
    const handle = subdirHandleCache.get(subdirPath);
    if (!handle) return;

    // Toggle expansion
    const willExpand = !expandedPaths.has(subdirPath);
    if (willExpand) {
      expandedPaths.add(subdirPath);
    } else {
      expandedPaths.delete(subdirPath);
    }
    expandedPaths = new Set(expandedPaths);

    // Load contents if expanding and not already loaded
    if (willExpand && !localFolderContents.has(subdirPath)) {
      await loadLocalFolderContents(subdirPath, handle);
    }
  }
</script>

{#snippet linkedFolderItem(
  item: { name: string; kind: 'file' | 'directory'; handle: FileSystemHandle },
  parentPath: string,
  itemDepth: number
)}
  {@const itemPath = `${parentPath}/${item.name}`}
  {@const isDir = item.kind === 'directory'}
  {@const isItemExpanded = expandedPaths.has(itemPath)}
  {@const paddingLeftPx = itemDepth * 12 + 8}

  <div class="group flex w-full items-center text-left text-xs hover:bg-zinc-800">
    <button
      class="flex flex-1 cursor-pointer items-center gap-1.5 py-1"
      style="padding-left: {paddingLeftPx}px"
      draggable={!isDir ? 'true' : 'false'}
      ondragstart={(e) => !isDir && handleLinkedFileDragStart(e, parentPath, item.name)}
      onclick={async () => {
        if (isDir) {
          await handleSubdirClick(itemPath);
        }
      }}
    >
      {#if isDir}
        {#if isItemExpanded}
          <ChevronDown class="h-3 w-3 shrink-0 text-zinc-500" />
          <FolderOpen class="h-3.5 w-3.5 shrink-0 text-yellow-500" />
        {:else}
          <ChevronRight class="h-3 w-3 shrink-0 text-zinc-500" />
          <Folder class="h-3.5 w-3.5 shrink-0 text-yellow-500" />
        {/if}
      {:else}
        {@const mimeType = guessMimeType(item.name)}
        {@const fileIcon = getFileIcon(mimeType)}
        <span class="w-3"></span>
        <fileIcon.icon class="h-3.5 w-3.5 shrink-0 {fileIcon.color}" />
      {/if}
      <span class="truncate font-mono text-zinc-300" title={item.name}>
        {item.name}
      </span>
    </button>
  </div>

  {#if isDir && isItemExpanded}
    {@const subdirContents = localFolderContents.get(itemPath)}
    {#if subdirContents && subdirContents.length > 0}
      {#each subdirContents as subItem}
        {@render linkedFolderItem(subItem, itemPath, itemDepth + 1)}
      {/each}
    {:else}
      <div
        class="px-2 py-1 font-mono text-xs text-zinc-600 italic"
        style="padding-left: {paddingLeftPx + 20}px"
      >
        {subdirContents ? 'Drop files to add' : 'Loading...'}
      </div>
    {/if}
  {/if}
{/snippet}

<!-- Hidden file input for uploads -->
<input
  bind:this={fileInputRef}
  type="file"
  multiple
  class="hidden"
  onchange={handleFileInputChange}
/>

<!-- Hidden file input for reselect -->
<input
  bind:this={reselectInputRef}
  type="file"
  class="hidden"
  onchange={handleReselectFileChange}
/>

{#snippet treeNode(node: TreeNode, depth: number = 0)}
  {@const isFolder = node.children !== undefined}
  {@const isEmptyFolder = isFolder && node.children?.size === 0}
  {@const isFile = !isFolder && node.entry}
  {@const isExpanded = node.path ? expandedPaths.has(node.path) : true}
  {@const isSelected = node.path ? selectedPaths.has(node.path) : false}
  {@const paddingLeft = depth * 12 + 8}
  {@const isUserNamespace = node.path === 'user://'}
  {@const isObjectNamespace = node.path === 'obj://'}
  {@const isDropTarget = isInDropTarget(node.path)}
  {@const isNamespace = isUserNamespace || isObjectNamespace}
  {@const isLinkedFolder = node.entry && isLocalFolder(node.entry)}
  {@const canHaveChildren =
    isNamespace || (isFolder && node.path?.startsWith('user://') && !isLinkedFolder)}
  {@const needsReselectFlag = needsReselect(node.path)}

  {@const isRenaming = renamingPath === node.path}
  {@const showContextMenu = node.path && !isNamespace && !isLinkedFolder}
  {@const isDraggable = (isFile || (isFolder && !isNamespace && !isLinkedFolder)) && node.path}

  {#if node.name !== 'root'}
    <ContextMenu.Root>
      <ContextMenu.Trigger disabled={!showContextMenu} class="block w-full">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="group flex w-full items-center text-left text-xs
						{needsReselectFlag
            ? 'bg-amber-900/30'
            : isDropTarget
              ? 'bg-blue-600/30'
              : isSelected
                ? 'bg-blue-900/40 hover:bg-blue-900/50'
                : 'hover:bg-zinc-800'}"
          ondragover={(e) => isFolder && node.path && handleFolderDragOver(e, node.path)}
          ondrop={(e) => isFolder && handleFolderDrop(e)}
        >
          <button
            class="flex flex-1 cursor-pointer items-center gap-1.5 py-1"
            style="padding-left: {paddingLeft}px"
            draggable={isDraggable ? 'true' : 'false'}
            ondragstart={(e) => isDraggable && handleDragStart(e, node)}
            onclick={async () => {
              if (isRenaming) return;
              if (isFolder && node.path && !isNamespace) {
                // For non-namespace folders: select (without deselect) and toggle expand
                selectedPaths = new Set([node.path]);
                // Check if we're about to expand (before toggling)
                const willExpand = !expandedPaths.has(node.path);
                toggleExpanded(node.path);
                // Load local folder contents when expanding
                if (isLinkedFolder && willExpand) {
                  await handleLocalFolderExpand(node.path);
                }
              } else if (isFolder && node.path) {
                // For namespace roots: just expand/collapse
                toggleExpanded(node.path);
              } else if (isFile && node.path) {
                toggleSelected(node.path);
              }
            }}
          >
            {#if isFolder}
              {#if isExpanded}
                <ChevronDown class="h-3 w-3 shrink-0 text-zinc-500" />
              {:else}
                <ChevronRight class="h-3 w-3 shrink-0 text-zinc-500" />
              {/if}
              {#if isUserNamespace}
                <User class="h-3.5 w-3.5 shrink-0 text-blue-400" />
              {:else if isObjectNamespace}
                <Box class="h-3.5 w-3.5 shrink-0 text-blue-400" />
              {:else if isLinkedFolder}
                <FolderSymlink class="h-3.5 w-3.5 shrink-0 text-cyan-400" />
              {:else if isExpanded}
                <FolderOpen class="h-3.5 w-3.5 shrink-0 text-yellow-500" />
              {:else}
                <Folder class="h-3.5 w-3.5 shrink-0 text-yellow-500" />
              {/if}
            {:else}
              {@const fileIcon = getFileIcon(
                node.entry?.mimeType || guessMimeType(node.entry?.filename || node.name)
              )}
              <span class="w-3"></span>
              <fileIcon.icon class="h-3.5 w-3.5 shrink-0 {fileIcon.color}" />
            {/if}

            {#if isRenaming}
              <!-- svelte-ignore a11y_autofocus -->
              <input
                type="text"
                class="flex-1 truncate rounded bg-transparent px-1 font-mono text-zinc-300 ring-1 ring-blue-500 outline-none"
                bind:value={renameInputValue}
                onkeydown={handleRenameSubmit}
                onclick={(e) => e.stopPropagation()}
                autofocus
              />
            {:else}
              <span
                class="truncate font-mono {isNamespace
                  ? 'font-medium text-zinc-200'
                  : 'text-zinc-300'}"
                title={node.entry?.filename || node.name}
              >
                {node.entry?.filename || node.name}
              </span>
            {/if}
          </button>

          {#if canHaveChildren && node.path}
            <div
              class="flex shrink-0 items-center gap-0.5 pr-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <Tooltip.Root>
                <Tooltip.Trigger>
                  <button
                    class="rounded p-0.5 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                    onclick={(e) => handleCreateFolderClick(node.path!, e)}
                    title="Create folder"
                  >
                    <FolderPlus class="h-3.5 w-3.5" />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Content side="bottom">Create folder</Tooltip.Content>
              </Tooltip.Root>

              {#if isUserNamespace && supportsDirectoryPicker}
                <Tooltip.Root>
                  <Tooltip.Trigger>
                    <button
                      class="rounded p-0.5 text-zinc-500 hover:bg-zinc-700 hover:text-cyan-400"
                      onclick={handleLinkFolderClick}
                      title="Link local folder"
                    >
                      <FolderSymlink class="h-3.5 w-3.5" />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content side="bottom">Link local folder</Tooltip.Content>
                </Tooltip.Root>
              {/if}

              <Tooltip.Root>
                <Tooltip.Trigger>
                  <button
                    class="rounded p-0.5 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                    onclick={(e) => handleUploadClick(node.path!, e)}
                    title="Upload file"
                  >
                    <Upload class="h-3.5 w-3.5" />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Content side="bottom">Upload file</Tooltip.Content>
              </Tooltip.Root>

              <Tooltip.Root>
                <Tooltip.Trigger>
                  <button
                    class="rounded p-0.5 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                    onclick={(e) => handleAddUrlClick(node.path!, e)}
                    title="Add from URL"
                  >
                    <Link class="h-3.5 w-3.5" />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Content side="bottom">Add from URL</Tooltip.Content>
              </Tooltip.Root>
            </div>
          {/if}

          {#if isLinkedFolder && node.path}
            <div
              class="flex shrink-0 items-center gap-0.5 pr-2 {needsReselectFlag
                ? ''
                : 'opacity-0 group-hover:opacity-100'}"
            >
              {#if needsReselectFlag}
                <Tooltip.Root>
                  <Tooltip.Trigger>
                    <button
                      class="rounded p-0.5 text-amber-400 hover:bg-amber-700/50 hover:text-amber-300"
                      onclick={(e) => handleRelinkFolderClick(node.path!, e)}
                      title="Re-link folder"
                    >
                      <FolderSymlink class="h-3.5 w-3.5" />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content side="bottom">Re-link folder</Tooltip.Content>
                </Tooltip.Root>
              {:else}
                <Tooltip.Root>
                  <Tooltip.Trigger>
                    <button
                      class="rounded p-0.5 text-zinc-500 hover:bg-zinc-700 hover:text-cyan-400"
                      onclick={(e) => handleRefreshLinkedFolder(node.path!, e)}
                      title="Refresh folder"
                    >
                      <RefreshCw class="h-3.5 w-3.5" />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content side="bottom">Refresh folder</Tooltip.Content>
                </Tooltip.Root>
              {/if}
            </div>
          {/if}

          {#if needsReselectFlag && isFile && node.path}
            <div class="flex shrink-0 items-center pr-2">
              <Tooltip.Root>
                <Tooltip.Trigger>
                  <button
                    class="rounded p-0.5 text-amber-400 hover:bg-amber-700/50 hover:text-amber-300"
                    onclick={(e) => handleReselectClick(node.path!, e)}
                    title="Re-link file"
                  >
                    <RefreshCw class="h-3.5 w-3.5" />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Content side="bottom">Re-link file</Tooltip.Content>
              </Tooltip.Root>
            </div>
          {/if}
        </div>
      </ContextMenu.Trigger>

      {#if showContextMenu}
        <ContextMenu.Content>
          <ContextMenu.Item
            onclick={() => handleRenameClick(node.path!, node.entry?.filename || node.name)}
          >
            <Pencil class="mr-2 h-4 w-4" />
            Rename
          </ContextMenu.Item>
          <ContextMenu.Item onclick={() => handleCopyPath(node.path!)}>
            <Copy class="mr-2 h-4 w-4" />
            Copy Path
          </ContextMenu.Item>
          <ContextMenu.Separator />
          <ContextMenu.Item
            variant="destructive"
            onclick={() => handleDeleteFromContextMenu(node.path!)}
          >
            <Trash2 class="mr-2 h-4 w-4" />
            Delete
          </ContextMenu.Item>
        </ContextMenu.Content>
      {/if}
    </ContextMenu.Root>

    <!-- URL input inline -->
    {#if showUrlInput === node.path}
      <div class="flex items-center gap-1 px-2 py-1" style="padding-left: {paddingLeft + 20}px">
        <Link class="mr-0.5 h-3 w-3 shrink-0 text-zinc-500" />
        <input
          type="text"
          class="flex-1 bg-transparent font-mono text-xs text-zinc-300 placeholder-zinc-500 outline-none"
          placeholder="Enter URL..."
          bind:value={urlInputValue}
          onkeydown={handleUrlSubmit}
          autofocus
        />
      </div>
    {/if}

    <!-- Folder name input inline - styled to match existing folder rows -->
    {#if showFolderInput === node.path}
      <div
        class="flex items-center gap-1.5 py-1"
        style="padding-left: {(node.name === 'root' ? 0 : depth + 1) * 12 + 8}px"
      >
        <ChevronRight class="h-3 w-3 shrink-0 text-zinc-500" />
        <Folder class="h-3.5 w-3.5 shrink-0 text-yellow-500" />
        <input
          type="text"
          class="flex-1 bg-transparent font-mono text-xs text-zinc-300 placeholder-zinc-500 outline-none"
          placeholder="Folder name..."
          bind:value={folderInputValue}
          onkeydown={handleFolderInputSubmit}
          autofocus
        />
      </div>
    {/if}
  {/if}

  {#if isFolder && (node.name === 'root' || isExpanded)}
    {#if isLinkedFolder && node.path}
      <!-- Render local folder contents from cache using recursive snippet -->
      {@const contents = localFolderContents.get(node.path)}
      {#if contents && contents.length > 0}
        {#each contents as item}
          {@render linkedFolderItem(item, node.path, depth + 1)}
        {/each}
      {:else}
        <div
          class="px-2 py-1 font-mono text-xs text-zinc-600 italic"
          style="padding-left: {paddingLeft + 20}px"
        >
          {contents ? 'Drop files to add' : 'Loading...'}
        </div>
      {/if}
    {:else if isEmptyFolder && node.name !== 'root'}
      <div
        class="px-2 py-1 font-mono text-xs text-zinc-600 italic"
        style="padding-left: {paddingLeft + 20}px"
      >
        Drop files to add
      </div>
    {:else}
      {#each getSortedChildren(node) as child}
        {@render treeNode(child, node.name === 'root' ? 0 : depth + 1)}
      {/each}
    {/if}
  {/if}
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="py-2 outline-none {dropTargetPath === 'user://' &&
  (!tree.children || tree.children.size === 0)
    ? 'bg-blue-600/30'
    : ''} {$isMobile && selectedFilePath ? 'pb-14' : ''}"
  tabindex="0"
  role="tree"
  onkeydown={handleKeydown}
  ondragover={handleTreeDragOver}
  ondragleave={handleFolderDragLeave}
  ondrop={handleFolderDrop}
>
  {@render treeNode(tree)}
</div>

<!-- Mobile floating toolbar -->
{#if $isMobile && selectedFilePath}
  <div
    class="fixed right-0 bottom-0 left-0 border-t border-zinc-800 bg-zinc-900/95 px-4 pt-2 backdrop-blur-sm"
    style="padding-bottom: calc(0.5rem + env(safe-area-inset-bottom, 0px))"
  >
    <div class="flex items-center justify-center gap-2">
      <span class="mr-2 max-w-32 truncate font-mono text-xs text-zinc-400">
        {selectedFileEntry?.filename || selectedFilePath.split('/').pop()}
      </span>

      <button
        class="flex cursor-pointer items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        onclick={handleInsertToCanvas}
        title="Insert to Canvas"
      >
        <Plus class="h-3.5 w-3.5" />
        <span>Insert</span>
      </button>

      <button
        class="flex cursor-pointer items-center gap-1.5 rounded bg-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-600"
        onclick={() => (showMoveDialog = true)}
        title="Move to folder"
      >
        <FolderInput class="h-3.5 w-3.5" />
        <span>Move</span>
      </button>

      <Popover.Root bind:open={mobileMoreOpen}>
        <Popover.Trigger
          class="flex cursor-pointer items-center rounded bg-zinc-700 p-1.5 text-zinc-200 hover:bg-zinc-600"
        >
          <Ellipsis class="h-4 w-4" />
        </Popover.Trigger>
        <Popover.Content class="w-40 border-zinc-700 bg-zinc-900 p-1" side="top" align="end">
          <button
            class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800"
            onclick={() => {
              if (selectedFilePath) {
                const entry = vfs.getEntry(selectedFilePath);
                handleRenameClick(
                  selectedFilePath,
                  entry?.filename || selectedFilePath.split('/').pop() || ''
                );
              }
              mobileMoreOpen = false;
            }}
          >
            <Pencil class="h-4 w-4 text-zinc-400" />
            Rename
          </button>
          <button
            class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800"
            onclick={async () => {
              if (selectedFilePath) {
                await handleCopyPath(selectedFilePath);
              }
              mobileMoreOpen = false;
            }}
          >
            <Copy class="h-4 w-4 text-zinc-400" />
            Copy Path
          </button>
          <button
            class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-red-400 hover:bg-zinc-800"
            onclick={async () => {
              if (selectedFilePath) {
                await handleDeleteFromContextMenu(selectedFilePath);
              }
              mobileMoreOpen = false;
            }}
          >
            <Trash2 class="h-4 w-4" />
            Delete
          </button>
        </Popover.Content>
      </Popover.Root>

      <button
        class="ml-auto text-xs text-zinc-500 hover:text-zinc-300"
        onclick={() => (selectedPaths = new Set())}
      >
        Cancel
      </button>
    </div>
  </div>
{/if}

<!-- Move to folder dialog -->
<FolderPickerDialog
  bind:open={showMoveDialog}
  title="Move to..."
  description="Select a destination folder"
  confirmText="Move here"
  folders={moveFolderTree}
  onSelect={handleMoveFile}
/>
