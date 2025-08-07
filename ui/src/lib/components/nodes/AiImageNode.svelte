<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import { generateImageWithGemini } from '$lib/ai/google';
	import { EditorView } from 'codemirror';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import ObjectPreviewLayout from '../ObjectPreviewLayout.svelte';
	import { match, P } from 'ts-pattern';

	let { id: nodeId, data }: { id: string; data: { prompt: string } } = $props();

	const { updateNodeData } = useSvelteFlow();

	const messageContext = new MessageContext(nodeId);

	let canvasElement: HTMLCanvasElement;
	let glSystem = GLSystem.getInstance();
	let errorMessage = $state<string | null>(null);
	let isLoading = $state(false);
	let hasImage = $state(false);
	let abortController: AbortController | null = null;

	const prompt = $derived(data.prompt || '');
	const setPrompt = (prompt: string) => updateNodeData(nodeId, { ...data, prompt });

	const handleMessage: MessageCallbackFn = (message) => {
		match(message)
			.with(P.string, (text) => {
				setPrompt(text);
				setTimeout(() => generateImage());
			})
			.with({ type: 'generate', prompt: P.string }, ({ prompt }) => {
				setPrompt(prompt);
				setTimeout(() => generateImage());
			})
			.with({ type: 'set', prompt: P.string }, ({ prompt }) => {
				setPrompt(prompt);
			})
			.with({ type: 'bang' }, generateImage);
	};

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
</script>

<ObjectPreviewLayout title="ai.img" onrun={generateImage}>
	{#snippet topHandle()}
		<Handle type="target" position={Position.Top} class="z-1" />
	{/snippet}

	{#snippet preview()}
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
	{/snippet}

	{#snippet bottomHandle()}
		<VideoHandle type="source" position={Position.Bottom} id="video-out" title="Video output" />
	{/snippet}

	{#snippet codeEditor()}
		<div class="max-w-[350px]">
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

			{#if errorMessage}
				<div class="mt-2 px-2 py-1 font-mono text-xs text-red-300">
					{errorMessage}
				</div>
			{/if}
		</div>
	{/snippet}
</ObjectPreviewLayout>
