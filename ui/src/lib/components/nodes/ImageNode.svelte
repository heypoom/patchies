<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';

	let node: {
		id: string;
		data: {
			fileName?: string;
			file?: File;
		};
		selected: boolean;
	} = $props();

	const { updateNodeData } = useSvelteFlow();

	let messageContext: MessageContext;
	let glSystem = GLSystem.getInstance();
	let isDragging = $state(false);
	let fileInputRef: HTMLInputElement;
	let canvasElement: HTMLCanvasElement | null = $state(null);
	let hasImage = $state(false);

	const fileName = $derived(node.data.fileName || 'No file selected');
	const hasFile = $derived(!!node.data.file);

	const handleMessage: MessageCallbackFn = () => {
		// Image node doesn't need to handle messages for now
	};

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
		updateNodeData(node.id, { ...node.data, file, fileName: file.name });

		try {
			const source = await createImageBitmap(file);
			const preview = await createImageBitmap(source);

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
	});

	onDestroy(() => {
		messageContext?.queue.removeCallback(handleMessage);
		messageContext?.destroy();
		glSystem.removeNode(node.id);
	});
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="relative">
				<Handle type="target" position={Position.Top} class="z-1" />

				<div class="flex flex-col gap-2">
					{#if hasFile && hasImage}
						<div class="relative">
							<canvas
								bind:this={canvasElement}
								width={800}
								height={600}
								class="h-[120px] w-[160px] rounded-md border border-zinc-700 bg-zinc-900"
							></canvas>

							<button
								title="Change image"
								class="absolute -right-2 -top-2 rounded-full border border-zinc-600 bg-zinc-800 p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
								onclick={openFileDialog}
							>
								<Icon icon="lucide:upload" class="h-3 w-3 text-zinc-300" />
							</button>
						</div>
					{:else}
						<div
							class="border-1 flex flex-col items-center justify-center gap-2 rounded-lg px-1 py-3
							{isDragging ? 'border-blue-400 bg-blue-50/10' : 'border-dashed border-zinc-600 bg-zinc-900'}"
							ondragover={handleDragOver}
							ondragleave={handleDragLeave}
							ondrop={handleDrop}
							onclick={openFileDialog}
						>
							<Icon icon="lucide:image" class="h-4 w-4 text-zinc-400" />

							<div class="px-2 text-center font-mono text-[8px] font-light text-zinc-400">
								<span class="text-zinc-300">select</span> or <span class="text-zinc-300">drop</span>
								image file
							</div>
						</div>
					{/if}
				</div>

				<VideoHandle type="source" position={Position.Bottom} id="video-out" title="Video output" />
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
