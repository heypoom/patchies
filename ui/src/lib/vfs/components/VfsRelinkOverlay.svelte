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
</script>

{#if needsFolderRelink}
	<!-- Folder needs to be re-linked via sidebar -->
	<div
		class={[
			'flex flex-col items-start justify-center gap-2 rounded-lg border border-amber-600/50 bg-amber-950/20 px-8 py-3 font-mono',
			className
		]}
		style="width: {width}px; height: {height}px"
		role="application"
	>
		<Lock class="mb-2 h-5 w-5 text-amber-400" />

		<div class="text-[12px] font-light text-zinc-400">Re-link folder in sidebar.</div>

		<div class="overflow-hidden text-[10px] font-light text-zinc-600">
			{linkedFolderName ? `Folder: ${linkedFolderName}` : vfsPath}
		</div>

		<div class="mt-1 text-[10px] text-zinc-500">
			Find the folder in the sidebar and click the re-link button.
		</div>
	</div>
{:else if needsReselect}
	<!-- File needs to be re-selected -->
	<div
		class={[
			'flex flex-col items-start justify-center gap-2 rounded-lg border border-amber-600/50 bg-amber-950/20 px-8 py-3 font-mono',
			isDragging ? 'border-transparent ring-2 ring-blue-400' : '',
			className
		]}
		style="width: {width}px; height: {height}px"
		ondragover={onDragOver}
		ondragleave={onDragLeave}
		ondrop={onDrop}
		role="application"
	>
		<Lock class="mb-2 h-5 w-5 text-amber-400" />

		<div class="text-[12px] font-light text-zinc-400">Re-select file.</div>

		<div class="overflow-hidden text-[10px] font-light text-zinc-600">
			{vfsPath}
		</div>

		<button
			class="mt-1 rounded bg-amber-600 px-2 py-1 font-mono text-[10px] text-white hover:bg-amber-500"
			onclick={onRequestPermission}
		>
			Choose File
		</button>
	</div>
{/if}
