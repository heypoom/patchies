<script lang="ts">
	import { Image, Upload } from '@lucide/svelte/icons';
	import { NodeResizer, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';

	let node: {
		id: string;
		data: {
			fileName?: string;
			file?: File;
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
	let isDragging = $state(false);
	let fileInputRef: HTMLInputElement;
	let canvasElement: HTMLCanvasElement | null = $state(null);
	let hasImage = $state(false);

	const [defaultPreviewWidth, defaultPreviewHeight] = glSystem.previewSize;
	const [defaultOutputWidth, defaultOutputHeight] = glSystem.outputSize;

	const hasFile = $derived(!!node.data.file);

	const handleMessage: MessageCallbackFn = (m) => {
		match(m)
			.with(P.string, (url) => {
				loadImageFromUrl(url);
			})
			.with({ type: 'load', url: P.string }, ({ url }) => {
				loadImageFromUrl(url);
			});
	};

	async function loadImageFromUrl(url: string) {
		try {
			const res = await fetch(url);
			const blob = await res.blob();

			// Extract filename from URL, fallback to generic name
			const filename = getFileNameFromUrl(url);
			const file = new File([blob], filename, { type: blob.type });
			await loadFile(file);
		} catch (err) {
			console.error('Failed to load image from URL:', err);
		}
	}

	function getFileNameFromUrl(url: string): string {
		try {
			const urlObj = new URL(url);
			const pathname = urlObj.pathname;
			const filename = pathname.substring(pathname.lastIndexOf('/') + 1);

			if (filename && filename.includes('.')) {
				return decodeURIComponent(filename);
			}
		} catch (error) {
			// URL parsing failed, continue to fallback
		}

		return 'image.png';
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		isDragging = false;

		const files = event.dataTransfer?.files;
		if (!files || files.length === 0) return;

		const file = files[0];
		if (!file.type.startsWith('image/')) {
			console.warn('Only image files are supported');
			return;
		}

		loadFile(file);
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = input.files;
		if (!files || files.length === 0) return;

		const file = files[0];
		loadFile(file);
	}

	async function loadFile(file: File) {
		const isFile = file instanceof File;

		try {
			if (!isFile) return;

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
					file,
					fileName: file.name,
					width: preview.width,
					height: preview.height
				}
			});

			// Flip when creating bitmap since ImageBitmap doesn't respect flipY in regl
			const source = await createImageBitmap(img, { imageOrientation: 'flipY' });
			glSystem.setBitmap(node.id, source);
			hasImage = true;

			setTimeout(() => {
				setPreviewImage(preview);
			}, 50);
		} catch (error) {
			console.error('Failed to load image:', error);
			hasImage = false;
		}
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
		fileInputRef?.click();
	}

	onMount(() => {
		messageContext = new MessageContext(node.id);
		messageContext.queue.addCallback(handleMessage);

		// Register node with GLSystem
		glSystem.upsertNode(node.id, 'img', {});

		if (node.data.file) {
			loadFile(node.data.file);
		}
	});

	onDestroy(() => {
		messageContext?.queue.removeCallback(handleMessage);
		messageContext?.destroy();
		glSystem.removeNode(node.id);
	});

	const handleCommonClass = $derived.by(() => {
		return `z-1 transition-opacity ${node.selected ? '' : 'sm:opacity-0 opacity-30 group-hover:opacity-100'}`;
	});
</script>

<div class="relative">
	<NodeResizer class="z-1" isVisible={node.selected} keepAspectRatio />

	{#if node.selected}
		<div class="absolute -top-7 z-10 w-fit rounded-lg bg-zinc-900/60 px-2 py-1 backdrop-blur-lg">
			<div class="font-mono text-xs font-medium text-zinc-400">img</div>
		</div>
	{/if}

	<div class="group relative">
		<div class="flex flex-col gap-2">
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
					{#if hasFile && hasImage}
						<div class="relative">
							<canvas
								bind:this={canvasElement}
								width={node.data.width ?? defaultOutputWidth}
								height={node.data.height ?? defaultOutputHeight}
								class="rounded-md"
								style="width: {node.width ?? defaultPreviewWidth}px; height: {node.height ??
									defaultPreviewHeight}px"
							></canvas>

							<button
								title="Change image"
								class="absolute -right-2 -top-2 rounded-full border border-zinc-600 bg-zinc-800 p-1 transition-opacity hover:bg-zinc-700 group-hover:opacity-100 sm:opacity-0"
								onclick={openFileDialog}
							>
								<Upload class="h-3 w-3 text-zinc-300" />
							</button>
						</div>
					{:else}
						<div
							class="border-1 flex flex-col items-center justify-center gap-2 rounded-lg px-1 py-3
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
							<Image class="h-4 w-4 text-zinc-400" />

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
