<script lang="ts">
	import {
		ChevronRight,
		ChevronDown,
		File,
		FileText,
		FileVideo,
		Folder,
		FolderOpen,
		Image,
		User,
		Box
	} from '@lucide/svelte/icons';
	import { VirtualFilesystem } from '$lib/vfs';
	import { parseVFSPath, type VFSEntry } from '$lib/vfs/types';

	interface TreeNode {
		name: string;
		path?: string;
		entry?: VFSEntry;
		children?: Map<string, TreeNode>;
		isExpanded?: boolean;
	}

	let expandedPaths = $state(new Set<string>(['user://', 'obj://']));
	let selectedPaths = $state(new Set<string>());

	function toggleSelected(path: string) {
		if (selectedPaths.has(path)) {
			selectedPaths = new Set();
		} else {
			selectedPaths = new Set([path]);
		}
	}

	function handleDragStart(event: DragEvent, node: TreeNode) {
		if (!node.path || !node.entry) return;

		event.dataTransfer?.setData('application/x-vfs-path', node.path);
		event.dataTransfer?.setData('text/plain', node.path);

		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'copy';
		}
	}

	// Build tree structure from VFS entries
	const tree = $derived.by(() => {
		const vfs = VirtualFilesystem.getInstance();
		const entries = vfs.getAllEntries();

		const root: TreeNode = {
			name: 'root',
			children: new Map()
		};

		// Create namespace roots
		const userRoot: TreeNode = { name: 'user', path: 'user://', children: new Map() };
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
					current.children.set(segment, {
						name: segment,
						path: nodePath,
						children: isLast ? undefined : new Map(),
						entry: isLast ? entry : undefined
					});
				}

				current = current.children.get(segment)!;
			}
		}

		// Only add roots if they have children
		if (userRoot.children && userRoot.children.size > 0) {
			root.children!.set('user', userRoot);
		}
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

	function getFileIcon(mimeType?: string) {
		if (!mimeType) return { icon: File, color: 'text-zinc-400' };

		if (mimeType.startsWith('image/')) {
			return { icon: Image, color: 'text-green-400' };
		}
		if (mimeType.startsWith('video/')) {
			return { icon: FileVideo, color: 'text-pink-400' };
		}
		if (mimeType.startsWith('text/') || mimeType === 'application/json') {
			return { icon: FileText, color: 'text-blue-400' };
		}

		return { icon: File, color: 'text-zinc-400' };
	}
</script>

{#snippet treeNode(node: TreeNode, depth: number = 0)}
	{@const isFolder = node.children && node.children.size > 0}
	{@const isFile = !isFolder && node.entry}
	{@const isExpanded = node.path ? expandedPaths.has(node.path) : true}
	{@const isSelected = node.path ? selectedPaths.has(node.path) : false}
	{@const paddingLeft = depth * 12 + 8}
	{@const isUserNamespace = node.path === 'user://'}
	{@const isObjectNamespace = node.path === 'obj://'}

	{#if node.name !== 'root'}
		<button
			class="flex w-full items-center gap-1.5 px-2 py-1 text-left text-xs
				{isSelected ? 'bg-blue-900/40 hover:bg-blue-900/50' : 'hover:bg-zinc-800'}"
			style="padding-left: {paddingLeft}px"
			draggable={isFile ? 'true' : 'false'}
			ondragstart={(e) => isFile && handleDragStart(e, node)}
			onclick={() => {
				if (isFolder && node.path) {
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
					<User class="h-3.5 w-3.5 shrink-0 text-yellow-400" />
				{:else if isObjectNamespace}
					<Box class="h-3.5 w-3.5 shrink-0 text-purple-400" />
				{:else if isExpanded}
					<FolderOpen class="h-3.5 w-3.5 shrink-0 text-yellow-500" />
				{:else}
					<Folder class="h-3.5 w-3.5 shrink-0 text-yellow-500" />
				{/if}
			{:else}
				{@const fileIcon = getFileIcon(node.entry?.mimeType)}
				<span class="w-3"></span>
				<svelte:component this={fileIcon.icon} class="h-3.5 w-3.5 shrink-0 {fileIcon.color}" />
			{/if}

			<span class="truncate font-mono text-zinc-300" title={node.entry?.filename || node.name}>
				{node.entry?.filename || node.name}
			</span>
		</button>
	{/if}

	{#if isFolder && (node.name === 'root' || isExpanded)}
		{#each [...(node.children?.entries() || [])] as [, child]}
			{@render treeNode(child, node.name === 'root' ? 0 : depth + 1)}
		{/each}
	{/if}
{/snippet}

<div class="py-2">
	{#if tree.children && tree.children.size > 0}
		{@render treeNode(tree)}
	{:else}
		<div class="px-4 py-8 text-center text-xs text-zinc-500">
			<p>No files in the virtual filesystem.</p>
			<p class="mt-2">Drop files onto the canvas to add them.</p>
		</div>
	{/if}
</div>
