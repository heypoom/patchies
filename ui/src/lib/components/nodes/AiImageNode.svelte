<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import { generateImageWithGemini } from '$lib/ai/google';
	import { EditorView } from 'codemirror';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { Message } from '$lib/messages/MessageSystem';
	import { GLSystem } from '$lib/canvas/GLSystem';

	// Get node data from XY Flow - nodes receive their data as props
	let { id: nodeId, data }: { id: string; data: { prompt: string } } = $props();

	// Get flow utilities to update node data
	const { updateNodeData } = useSvelteFlow();

	const messageContext = new MessageContext(nodeId);

	let canvasElement: HTMLCanvasElement;
	let glSystem = GLSystem.getInstance();
	let showEditor = $state(false);
	let errorMessage = $state<string | null>(null);
	let isLoading = $state(false);
	let hasImage = $state(false);
	let abortController: AbortController | null = null;

	const prompt = $derived(data.prompt || '');
	const setPrompt = (prompt: string) => updateNodeData(nodeId, { ...data, prompt });

	function handleMessage(message: Message) {
		if (typeof message.data === 'string') {
			setPrompt(message.data);
			setTimeout(() => generateImage());
		} else if (message.data.type === 'generate') {
			setPrompt(message.data.prompt);
			setTimeout(() => generateImage());
		} else if (message.data.type === 'set') {
			setPrompt(message.data.prompt);
		} else if (message.data.type === 'bang') {
			generateImage();
		}
	}

	onMount(() => {
		glSystem.upsertNode(nodeId, 'img', {});

		messageContext.queue.addCallback(handleMessage);
	});

	onDestroy(() => {
		glSystem.removeNode(nodeId);
		messageContext.queue.removeCallback(handleMessage);
		messageContext.destroy();
	});

	async function generateImage() {
		if (isLoading) {
			if (abortController) {
				abortController.abort();
			}

			isLoading = false;

			return;
		}

		hasImage = false;
		isLoading = true;
		errorMessage = null;

		try {
			const apiKey = localStorage.getItem('gemini-api-key');

			if (!apiKey) {
				throw new Error('API key not found. Please set your Gemini API key with CMD+K.');
			}

			abortController = new AbortController();

			const image = await generateImageWithGemini(prompt, {
				apiKey,
				aspectRatio: '4:3',
				abortSignal: abortController.signal
			});

			if (!image) {
				throw new Error('Cannot generate image.');
			}

			const previewBitmap = await createImageBitmap(image);
			glSystem.setBitmap(nodeId, image);

			// draw the preview image to the canvas
			canvasElement
				.getContext('2d')
				?.drawImage(
					previewBitmap,
					0,
					0,
					previewBitmap.width,
					previewBitmap.height,
					0,
					0,
					canvasElement.width,
					canvasElement.height
				);

			hasImage = true;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
			hasImage = false;
		} finally {
			isLoading = false;
		}
	}

	function toggleEditor() {
		showEditor = !showEditor;
	}
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
					<div class="font-mono text-xs font-medium text-zinc-100">ai.img</div>
				</div>

				<button
					class="rounded p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
					onclick={toggleEditor}
					title="Edit code"
				>
					<Icon icon="lucide:code" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="relative">
				<Handle type="target" position={Position.Top} class="z-1" />

				<div class="relative">
					{#if !hasImage || isLoading}
						<div class="pointer-events-none absolute h-full w-full">
							<div class="flex h-full items-center justify-center">
								<Icon
									icon={isLoading ? 'lucide:loader' : 'lucide:image'}
									class={`h-8 w-8 text-zinc-300 ${isLoading ? 'animate-spin' : ''}`}
								/>
							</div>
						</div>
					{/if}

					<canvas
						bind:this={canvasElement}
						width={800}
						height={600}
						class="h-[150px] w-[200px] rounded-md bg-zinc-900"
					></canvas>
				</div>

				<VideoHandle type="source" position={Position.Bottom} id="video-out" title="Video output" />
			</div>
		</div>
	</div>

	{#if showEditor}
		<div class="relative max-w-[350px]">
			<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
				<button onclick={generateImage} class="rounded p-1 hover:bg-zinc-700">
					<Icon icon={isLoading ? 'lucide:square' : 'lucide:play'} class="h-4 w-4 text-zinc-300" />
				</button>

				<button onclick={() => (showEditor = false)} class="rounded p-1 hover:bg-zinc-700">
					<Icon icon="lucide:x" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
				<CodeEditor
					value={prompt}
					onchange={(newPrompt) => {
						updateNodeData(nodeId, { ...data, prompt: newPrompt });
					}}
					language="text"
					placeholder="Write your prompt here..."
					class="nodrag h-64 w-full max-w-[350px] resize-none"
					onrun={generateImage}
					extraExtensions={[EditorView.lineWrapping]}
				/>
			</div>

			{#if errorMessage}
				<div class="mt-2 px-2 py-1 font-mono text-xs text-red-300">
					{errorMessage}
				</div>
			{/if}
		</div>
	{/if}
</div>
