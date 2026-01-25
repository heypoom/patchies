<script lang="ts">
	import { Image as ImageIcon, Upload, Lock } from '@lucide/svelte/icons';
	import { NodeResizer, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { shouldShowHandles } from '../../../stores/ui.store';
	import { VirtualFilesystem, isVFSPath } from '$lib/vfs';
	import { logger } from '$lib/utils/logger';

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
	let vfs = VirtualFilesystem.getInstance();
	let isDragging = $state(false);
	let fileInputRef: HTMLInputElement;
	let canvasElement: HTMLCanvasElement | null = $state(null);
	let hasImage = $state(false);
	let needsReselect = $state(false);
	let isLoading = $state(false);

	const [defaultPreviewWidth, defaultPreviewHeight] = glSystem.previewSize;
	const [defaultOutputWidth, defaultOutputHeight] = glSystem.outputSize;

	const hasVfsPath = $derived(!!node.data.vfsPath);

	const handleMessage: MessageCallbackFn = (m) => {
		match(m)
			.with(P.string, loadFromPath)
			.with({ type: 'load', url: P.string }, ({ url }) => {
				loadImageFromUrl(url);
			})
			.with({ type: 'load', path: P.string }, ({ path }) => {
				loadFromPath(path);
			});
	};

	function loadFromPath(urlOrPath: string) {
		if (isVFSPath(urlOrPath)) {
			loadFromVfsPath(urlOrPath);
		} else {
			loadImageFromUrl(urlOrPath);
		}
	}

	async function loadImageFromUrl(url: string) {
		try {
			isLoading = true;
			const vfsPath = await vfs.registerUrl(url);

			// Update node data with VFS path
			updateNode(node.id, { data: { ...node.data, vfsPath } });

			await loadFromVfsPath(vfsPath);
		} catch (err) {
			console.error('Failed to load image from URL:', err);
			isLoading = false;
		}
	}

	async function loadFromVfsPath(vfsPath: string) {
		try {
			isLoading = true;
			needsReselect = false;

			const fileOrBlob = await vfs.resolve(vfsPath);

			const file =
				fileOrBlob instanceof File
					? fileOrBlob
					: new File([fileOrBlob], 'image', { type: fileOrBlob.type });

			await displayImage(file);
		} catch (err) {
			logger.error('[vfs load error]', err);

			// Check if it's a permission error or missing handle/data
			if (
				err instanceof Error &&
				(err.message.includes('Permission denied') ||
					err.message.includes('No handle or cached data found'))
			) {
				needsReselect = true;
			}

			hasImage = false;
		} finally {
			isLoading = false;
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		isDragging = false;

		// Check for VFS path drop first
		const vfsPathData = event.dataTransfer?.getData('application/x-vfs-path');
		if (vfsPathData) {
			// Verify it's an image file
			const entry = vfs.getEntry(vfsPathData);

			if (entry?.mimeType?.startsWith('image/')) {
				updateNode(node.id, { data: { ...node.data, vfsPath: vfsPathData } });
				await loadFromVfsPath(vfsPathData);
				return;
			} else {
				console.warn('Only image files are supported, got:', entry?.mimeType);
				return;
			}
		}

		const items = event.dataTransfer?.items;
		if (!items || items.length === 0) return;

		const item = items[0];
		if (!item.type.startsWith('image/')) {
			console.warn('Only image files are supported');
			return;
		}

		// Try to get FileSystemFileHandle for persistence (Chrome 86+)
		let handle: FileSystemFileHandle | undefined;
		if ('getAsFileSystemHandle' in item) {
			try {
				const fsHandle = await (
					item as DataTransferItem & { getAsFileSystemHandle(): Promise<FileSystemHandle | null> }
				).getAsFileSystemHandle();
				if (fsHandle?.kind === 'file') {
					handle = fsHandle as FileSystemFileHandle;
				}
			} catch {
				// Not supported or user denied - fall back to file-only
			}
		}

		const file = item.getAsFile();
		if (!file) return;

		await loadFile(file, handle);
	}

	async function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = input.files;
		if (!files || files.length === 0) return;

		const file = files[0];

		// If we're replacing an existing file that needs reselection, use replaceFile
		if (node.data.vfsPath && needsReselect) {
			await vfs.replaceFile(node.data.vfsPath, file);
			await displayImage(file);
		} else {
			// File input doesn't give us handles, so we'll use showOpenFilePicker for persistence
			// For now, just load without handle (won't persist across reloads)
			await loadFile(file);
		}

		// Reset input so same file can be selected again
		input.value = '';
	}

	/**
	 * Open file picker with handle support for persistence.
	 * This is the recommended way to select files for reload persistence.
	 */
	async function openFilePickerWithHandle() {
		try {
			// Use File System Access API if available
			if ('showOpenFilePicker' in window) {
				// @ts-expect-error - showOpenFilePicker is not typed
				const [handle] = await window.showOpenFilePicker({
					types: [
						{
							description: 'Images',
							accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'] }
						}
					],
					multiple: false
				});

				const file = await handle.getFile();
				await loadFile(file, handle);
			} else {
				// Fall back to traditional file input
				fileInputRef?.click();
			}
		} catch (err) {
			// User cancelled or error - ignore
			if (err instanceof Error && err.name !== 'AbortError') {
				console.error('File picker error:', err);
			}
		}
	}

	async function loadFile(file: File, handle?: FileSystemFileHandle) {
		try {
			isLoading = true;

			const vfsPath = await vfs.storeFile(file, handle);
			updateNode(node.id, { data: { ...node.data, vfsPath } });

			await displayImage(file);
		} catch (error) {
			console.error('Failed to load image:', error);
			hasImage = false;
		} finally {
			isLoading = false;
		}
	}

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
		needsReselect = false;

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

	function openFileDialog() {
		// Use the handle-based picker for persistence support
		openFilePickerWithHandle();
	}

	async function requestFilePermission() {
		if (!node.data.vfsPath) return;

		// First try to request permission from existing handle
		const granted = await vfs.requestPermission(node.data.vfsPath);
		if (granted) {
			needsReselect = false;
			await loadFromVfsPath(node.data.vfsPath);
			return;
		}

		// If no handle exists (file was dropped without handle support),
		// prompt user to re-select the file
		const entry = vfs.getEntry(node.data.vfsPath);
		const filename = entry?.filename || 'the file';

		console.log(`VFS: No handle for ${node.data.vfsPath}, prompting user to re-select ${filename}`);

		// Open file picker and replace the existing VFS entry
		try {
			if ('showOpenFilePicker' in window) {
				// @ts-expect-error - showOpenFilePicker is not typed
				const [handle] = await window.showOpenFilePicker({
					types: [
						{
							description: 'Images',
							accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'] }
						}
					],
					multiple: false
				});

				const file = await handle.getFile();
				// Replace file at the existing path instead of creating a new one
				await vfs.replaceFile(node.data.vfsPath, file, handle);
				await displayImage(file);
			} else {
				// Fall back to traditional file input (won't have handle for persistence)
				fileInputRef?.click();
			}
		} catch (err) {
			if (err instanceof Error && err.name !== 'AbortError') {
				console.error('File picker error:', err);
			}
		}
	}

	onMount(async () => {
		messageContext = new MessageContext(node.id);
		messageContext.queue.addCallback(handleMessage);

		// Register node with GLSystem
		glSystem.upsertNode(node.id, 'img', {});

		// If we have a VFS path, try to load from it
		if (node.data.vfsPath) {
			await loadFromVfsPath(node.data.vfsPath);
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

				{#if hasVfsPath && hasImage}
					<div class="flex gap-1">
						<button
							title="Change image"
							class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
							onclick={openFileDialog}
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
					{#if hasVfsPath && hasImage}
						<canvas
							bind:this={canvasElement}
							width={node.data.width ?? defaultOutputWidth}
							height={node.data.height ?? defaultOutputHeight}
							class="rounded-md {isDragging ? 'ring-2 ring-blue-400' : ''}"
							style="width: {node.width ?? defaultPreviewWidth}px; height: {node.height ??
								defaultPreviewHeight}px"
							ondragover={handleDragOver}
							ondragleave={handleDragLeave}
							ondrop={handleDrop}
						></canvas>
					{:else if hasVfsPath && needsReselect}
						<div
							class="flex flex-col items-center justify-center gap-2 rounded-lg border border-amber-600/50 bg-amber-950/20 px-1 py-3"
							style="width: {node.width ?? defaultPreviewWidth}px; height: {node.height ??
								defaultPreviewHeight}px"
						>
							<Lock class="h-4 w-4 text-amber-400" />

							<div class="px-2 text-center font-mono text-[12px] font-light text-zinc-400">
								Re-select file
							</div>

							<div class="px-2 text-center font-mono text-[12px] font-light text-zinc-400">
								{node.data.vfsPath}
							</div>

							<button
								class="rounded bg-amber-600 px-2 py-1 font-mono text-[10px] text-white hover:bg-amber-500"
								onclick={requestFilePermission}
							>
								Choose File
							</button>
						</div>
					{:else if isLoading}
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
						<div
							class="flex flex-col items-center justify-center gap-2 rounded-lg border-1 px-1 py-3
							{isDragging ? 'border-blue-400 bg-blue-50/10' : 'border-dashed border-zinc-600 bg-zinc-900'}"
							style="width: {node.width ?? defaultPreviewWidth}px; height: {node.height ??
								defaultPreviewHeight}px"
							ondragover={handleDragOver}
							ondragleave={handleDragLeave}
							ondrop={handleDrop}
							ondblclick={openFileDialog}
							role="button"
							tabindex="0"
							onkeydown={(e) => e.key === 'Enter' && openFileDialog()}
						>
							<ImageIcon class="h-4 w-4 text-zinc-400" />

							<div class="px-2 text-center font-mono text-[12px] font-light text-zinc-400">
								<span class="text-zinc-300">double click</span> or
								<span class="text-zinc-300">drop</span><br />
								image file
							</div>
						</div>
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
	bind:this={fileInputRef}
	type="file"
	accept="image/*"
	onchange={handleFileSelect}
	class="hidden"
/>
