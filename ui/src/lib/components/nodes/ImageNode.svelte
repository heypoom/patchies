<script lang="ts">
	import { Image as ImageIcon, Upload } from '@lucide/svelte/icons';
	import { NodeResizer, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { shouldShowHandles } from '../../../stores/ui.store';
	import { useVfsMedia } from '$lib/vfs';
	import { VfsRelinkOverlay, VfsDropZone } from '$lib/vfs/components';

	let node: {
		id: string;
		data: {
			vfsPath?: string;

			width?: number;
			height?: number;
		};
		selected: boolean;
		width: number;
		height: number;
	} = $props();

	const { updateNode } = useSvelteFlow();

	const IMAGE_PREVIEW_SCALE_FACTOR = 6;

	let messageContext: MessageContext;
	let glSystem = GLSystem.getInstance();
	let canvasElement: HTMLCanvasElement | null = $state(null);
	let hasImage = $state(false);

	const [defaultPreviewWidth, defaultPreviewHeight] = glSystem.previewSize;
	const [defaultOutputWidth, defaultOutputHeight] = glSystem.outputSize;

	// Use VFS media composable for all file handling
	const vfsMedia = useVfsMedia({
		nodeId: node.id,
		acceptMimePrefix: 'image/',
		onFileLoaded: displayImage,
		updateNodeData: (data) => updateNode(node.id, { data: { ...node.data, ...data } }),
		getVfsPath: () => node.data.vfsPath,
		filePickerAccept: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'],
		filePickerDescription: 'Images'
	});

	const handleMessage: MessageCallbackFn = (m) => {
		match(m)
			.with(P.string, vfsMedia.loadFromPath)
			.with({ type: 'load', url: P.string }, ({ url }) => vfsMedia.loadFromUrl(url))
			.with({ type: 'load', path: P.string }, ({ path }) => vfsMedia.loadFromPath(path));
	};

	async function displayImage(file: File) {
		const img = new Image();
		const objectUrl = URL.createObjectURL(file);

		await new Promise<void>((resolve, reject) => {
			img.onload = () => resolve();
			img.onerror = () => reject(new Error('failed to load image'));
			img.src = objectUrl;
		});

		const preview = await createImageBitmap(img);

		URL.revokeObjectURL(objectUrl);

		const previewWidth = Math.round(preview.width / IMAGE_PREVIEW_SCALE_FACTOR);
		const previewHeight = Math.round(preview.height / IMAGE_PREVIEW_SCALE_FACTOR);

		updateNode(node.id, {
			width: previewWidth,
			height: previewHeight,
			data: {
				...node.data,
				width: preview.width,
				height: preview.height
			}
		});

		// Flip when creating bitmap since ImageBitmap doesn't respect flipY in regl
		const source = await createImageBitmap(img, { imageOrientation: 'flipY' });
		glSystem.setPreflippedBitmap(node.id, source);
		hasImage = true;
		vfsMedia.markLoaded();

		setTimeout(() => {
			setPreviewImage(preview);
		}, 50);
	}

	function setPreviewImage(bitmap: ImageBitmap) {
		if (!canvasElement) return;

		const ctx = canvasElement.getContext('2d');

		if (ctx) {
			ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

			ctx.drawImage(
				bitmap,
				0,
				0,
				bitmap.width,
				bitmap.height,
				0,
				0,
				canvasElement.width,
				canvasElement.height
			);
		}
	}

	onMount(async () => {
		messageContext = new MessageContext(node.id);
		messageContext.queue.addCallback(handleMessage);

		// Register node with GLSystem
		glSystem.upsertNode(node.id, 'img', {});

		// If we have a VFS path, try to load from it
		if (node.data.vfsPath) {
			await vfsMedia.loadFromVfsPath(node.data.vfsPath);
		}
	});

	onDestroy(() => {
		messageContext?.queue.removeCallback(handleMessage);
		messageContext?.destroy();

		glSystem.removeNode(node.id);
	});

	const handleCommonClass = $derived.by(() => {
		if (!node.selected && $shouldShowHandles) {
			return 'z-1 transition-opacity';
		}
		return `z-1 transition-opacity ${node.selected ? '' : 'sm:opacity-0 opacity-30 group-hover:opacity-100'}`;
	});
</script>

<div class="relative">
	<NodeResizer class="z-1" isVisible={node.selected} keepAspectRatio />

	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-black/60 px-2 py-1">
					<div class="font-mono text-xs font-medium text-zinc-400">img</div>
				</div>

				{#if vfsMedia.hasVfsPath && hasImage}
					<div class="flex gap-1">
						<button
							title="Change image"
							class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
							onclick={vfsMedia.openFileDialog}
						>
							<Upload class="h-4 w-4 text-zinc-300" />
						</button>
					</div>
				{/if}
			</div>

			<div class="relative">
				<StandardHandle
					port="inlet"
					type="message"
					total={1}
					index={0}
					class={handleCommonClass}
					nodeId={node.id}
				/>

				<div class="flex flex-col gap-2">
					{#if vfsMedia.hasVfsPath && hasImage}
						<canvas
							bind:this={canvasElement}
							width={node.data.width ?? defaultOutputWidth}
							height={node.data.height ?? defaultOutputHeight}
							class="rounded-md {vfsMedia.isDragging ? 'ring-2 ring-blue-400' : ''}"
							style="width: {node.width ?? defaultPreviewWidth}px; height: {node.height ??
								defaultPreviewHeight}px"
							ondragover={vfsMedia.handleDragOver}
							ondragleave={vfsMedia.handleDragLeave}
							ondrop={vfsMedia.handleDrop}
						></canvas>
					{:else if vfsMedia.needsFolderRelink || vfsMedia.needsReselect}
						<VfsRelinkOverlay
							needsReselect={vfsMedia.needsReselect}
							needsFolderRelink={vfsMedia.needsFolderRelink}
							linkedFolderName={vfsMedia.linkedFolderName}
							vfsPath={node.data.vfsPath}
							width={node.width ?? defaultPreviewWidth}
							height={node.height ?? defaultPreviewHeight}
							isDragging={vfsMedia.isDragging}
							onRequestPermission={vfsMedia.requestFilePermission}
							onDragOver={vfsMedia.handleDragOver}
							onDragLeave={vfsMedia.handleDragLeave}
							onDrop={vfsMedia.handleDrop}
						/>
					{:else if vfsMedia.isLoading}
						<div
							class="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-600 bg-zinc-900 px-1 py-3"
							style="width: {node.width ?? defaultPreviewWidth}px; height: {node.height ??
								defaultPreviewHeight}px"
						>
							<div
								class="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent"
							></div>
							<div class="px-2 text-center font-mono text-[12px] font-light text-zinc-400">
								Loading...
							</div>
						</div>
					{:else}
						<VfsDropZone
							icon={ImageIcon}
							fileType="image"
							width={node.width ?? defaultPreviewWidth}
							height={node.height ?? defaultPreviewHeight}
							isDragging={vfsMedia.isDragging}
							onDoubleClick={vfsMedia.openFileDialog}
							onDragOver={vfsMedia.handleDragOver}
							onDragLeave={vfsMedia.handleDragLeave}
							onDrop={vfsMedia.handleDrop}
						/>
					{/if}
				</div>

				<StandardHandle
					port="outlet"
					type="video"
					id="0"
					title="Video output"
					total={1}
					index={0}
					class={handleCommonClass}
					nodeId={node.id}
				/>
			</div>
		</div>
	</div>
</div>

<!-- Hidden file input -->
<input
	bind:this={vfsMedia.fileInputRef}
	type="file"
	accept="image/*"
	onchange={vfsMedia.handleFileSelect}
	class="hidden"
/>
