<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import { VideoSystem } from '$lib/video/VideoSystem';
	import { createLLMFunction } from '$lib/ai/google';
	import { EditorView } from 'codemirror';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { Message } from '$lib/messages/MessageSystem';

	let { id: nodeId, data }: { id: string; data: { prompt: string } } = $props();

	const { updateNodeData } = useSvelteFlow();

	const messageContext = new MessageContext(nodeId);

	let videoSystem: VideoSystem;
	let showEditor = $state(false);
	let errorMessage = $state<string | null>(null);
	let isLoading = $state(false);
	let generatedText = $state<string>('');
	let abortController: AbortController | null = null;
	let inputCanvases = $state<HTMLCanvasElement[]>([]);

	const prompt = $derived(data.prompt || '');
	const setPrompt = (prompt: string) => updateNodeData(nodeId, { ...data, prompt });

	function handleMessage(message: Message) {
		if (typeof message.data === 'string') {
			setPrompt(message.data);
			setTimeout(() => generateText());
		} else if (message.data.type === 'generate') {
			setPrompt(message.data.prompt);
			setTimeout(() => generateText());
		} else if (message.data.type === 'set') {
			setPrompt(message.data.prompt);
		} else if (message.data.type === 'bang') {
			generateText();
		}
	}

	onMount(() => {
		videoSystem = VideoSystem.getInstance();

		videoSystem.onVideoCanvas(nodeId, (canvases) => {
			inputCanvases = canvases;
		});

		messageContext.queue.addCallback(handleMessage);
	});

	onDestroy(() => {
		videoSystem?.unregisterNode(nodeId);
		messageContext.queue.removeCallback(handleMessage);
		messageContext.destroy();
	});

	async function generateText() {
		if (isLoading) {
			if (abortController) {
				abortController.abort();
			}
			isLoading = false;
			return;
		}

		isLoading = true;
		errorMessage = null;
		generatedText = '';

		try {
			const llmFunction = createLLMFunction();
			abortController = new AbortController();

			const context = { canvas: inputCanvases?.[0], abortSignal: abortController.signal };

			const llmOutput = await llmFunction(prompt, context);
			generatedText = llmOutput ?? '';

			messageContext.createSendFunction()(llmOutput);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			isLoading = false;
		}
	}

	function toggleEditor() {
		showEditor = !showEditor;
	}

	function copyToClipboard() {
		navigator.clipboard.writeText(generatedText);
	}
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
					<div class="font-mono text-xs font-medium text-zinc-100">ai.txt</div>
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

				<VideoHandle
					type="target"
					position={Position.Top}
					id="video-in"
					class="z-1 !left-32"
					title="Video input (optional)"
				/>

				<div class="relative w-[300px]">
					<div class="rounded-lg border border-zinc-600 bg-zinc-900 p-4">
						{#if isLoading}
							<div class="flex h-full items-center justify-center gap-y-2">
								<Icon icon="lucide:loader" class="h-6 w-6 animate-spin text-zinc-300" />
							</div>
						{:else if generatedText}
							<div class="nodrag relative">
								<textarea
									bind:value={generatedText}
									class="h-40 w-full rounded bg-transparent font-mono text-xs text-zinc-100 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
									readonly
								></textarea>

								<button
									onclick={copyToClipboard}
									class="absolute right-0 top-0 rounded p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
									title="Copy to clipboard"
								>
									<Icon icon="lucide:copy" class="h-4 w-4 text-zinc-300" />
								</button>
							</div>
						{:else}
							<div class="flex h-full items-center justify-center text-zinc-400">
								<span class="font-mono text-xs">use the edit button to add prompts</span>
							</div>
						{/if}
					</div>
				</div>

				<Handle type="source" position={Position.Bottom} class="z-1" />
			</div>
		</div>
	</div>

	{#if showEditor}
		<div class="relative max-w-[350px]">
			<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
				<button onclick={generateText} class="rounded p-1 hover:bg-zinc-700">
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
					onrun={generateText}
					extraExtensions={[EditorView.lineWrapping]}
				/>
			</div>

			{#if errorMessage}
				<div class="mt-2 px-2 py-1 font-mono text-xs text-red-300">
					{errorMessage}
				</div>
			{/if}

			{#if inputCanvases.length > 0}
				<div class="mt-2 text-xs text-zinc-400">
					Image input: {inputCanvases.length} canvas{inputCanvases.length !== 1 ? 'es' : ''} connected
				</div>
			{/if}
		</div>
	{/if}
</div>
