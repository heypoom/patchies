<script lang="ts">
	import { Lock } from '@lucide/svelte/icons';

	interface Props {
		/** Whether the file needs to be re-selected (handle lost/permission denied) */
		needsReselect: boolean;

		/** Whether the containing folder needs to be re-linked */
		needsFolderRelink: boolean;

		/** Display name of the linked folder (for folder relink case) */
		linkedFolderName: string | null;

		/** The VFS path (for display) */
		vfsPath: string | undefined;

		/** Width of the overlay */
		width: number;

		/** Height of the overlay */
		height: number;

		/** Whether user is dragging a file over (for file reselect case) */
		isDragging?: boolean;

		/** Callback when user requests to choose a file */
		onRequestPermission?: () => void;

		/** Drag event handlers (for file reselect case) */
		onDragOver?: (e: DragEvent) => void;
		onDragLeave?: (e: DragEvent) => void;
		onDrop?: (e: DragEvent) => void;

		/** Additional CSS classes */
		class?: string;
	}

	let {
		needsReselect,
		needsFolderRelink,
		linkedFolderName,
		vfsPath,
		width,
		height,
		isDragging = false,
		onRequestPermission,
		onDragOver,
		onDragLeave,
		onDrop,
		class: className = ''
	}: Props = $props();

	// Compact mode for small heights
	const isCompact = $derived(height < 120);
</script>

{#if needsFolderRelink}
	<!-- Folder needs to be re-linked via sidebar -->
	<div
		class={[
			'flex flex-col items-start justify-center overflow-hidden rounded-lg border border-amber-600/50 bg-amber-950/20 font-mono',
			isCompact ? 'gap-1 px-3 py-2' : 'gap-2 px-8 py-3',
			className
		]}
		style="width: {width}px; height: {height}px"
		role="application"
	>
		{#if isCompact}
			<!-- Compact: inline layout -->
			<div class="flex items-center justify-center gap-2 px-2">
				<Lock class="mr-1 h-4 w-4 flex-shrink-0 text-amber-400" />
				<div class="text-[11px] font-light text-zinc-400">
					Re-link <span class="font-medium text-zinc-300">{linkedFolderName}</span> in sidebar.
				</div>
			</div>
		{:else}
			<!-- Normal: stacked layout -->
			<Lock class="mb-2 h-5 w-5 text-amber-400" />

			<div class="text-[12px] font-light text-zinc-400">
				Re-link <span class="font-medium text-zinc-300">{linkedFolderName ?? 'folder'}</span> in sidebar.
			</div>

			{#if !linkedFolderName}
				<div class="overflow-hidden text-[10px] font-light text-zinc-500">
					{vfsPath}
				</div>
			{/if}

			<div class="mt-1 text-[10px] text-zinc-500">
				Find the folder in the sidebar and click <span class="font-medium text-zinc-300"
					>re-link</span
				>.
			</div>
		{/if}
	</div>
{:else if needsReselect}
	<!-- File needs to be re-selected -->
	<div
		class={[
			'flex flex-col items-start justify-center overflow-hidden rounded-lg border border-amber-600/50 bg-amber-950/20 font-mono',
			isCompact ? 'gap-1 px-3 py-2' : 'gap-2 px-8 py-3',
			isDragging ? 'border-transparent ring-2 ring-blue-400' : '',
			className
		]}
		style="width: {width}px; height: {height}px"
		ondragover={onDragOver}
		ondragleave={onDragLeave}
		ondrop={onDrop}
		role="application"
	>
		{#if isCompact}
			<!-- Compact: inline layout with button -->
			<div class="flex items-center gap-2">
				<Lock class="h-4 w-4 flex-shrink-0 text-amber-400" />
				<button
					class="rounded bg-amber-600 px-2 py-0.5 font-mono text-[10px] text-white hover:bg-amber-500"
					onclick={onRequestPermission}
				>
					Re-select file
				</button>
			</div>
		{:else}
			<!-- Normal: stacked layout -->
			<Lock class="mb-2 h-5 w-5 text-amber-400" />

			<div class="text-[12px] font-light text-zinc-400">Re-select file.</div>

			<div class="overflow-hidden text-[10px] font-light text-zinc-500">
				{vfsPath}
			</div>

			<button
				class="mt-1 rounded bg-amber-600 px-2 py-1 font-mono text-[10px] text-white hover:bg-amber-500"
				onclick={onRequestPermission}
			>
				Choose File
			</button>
		{/if}
	</div>
{/if}
