<script lang="ts">
	import { useNodeConnections, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { createLLMFunction } from '$lib/ai/google';
	import { EditorView } from 'codemirror';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import ObjectPreviewLayout from '../ObjectPreviewLayout.svelte';
	import { match, P } from 'ts-pattern';

	let { id: nodeId, data }: { id: string; data: { prompt: string } } = $props();

	const { updateNodeData } = useSvelteFlow();

	const messageContext = new MessageContext(nodeId);

	let errorMessage = $state<string | null>(null);
	let isLoading = $state(false);
	let generatedText = $state<string>('');
	let abortController: AbortController | null = null;

	const prompt = $derived(data.prompt || '');
	const setPrompt = (prompt: string) => updateNodeData(nodeId, { ...data, prompt });

	const targetConnections = useNodeConnections({ id: nodeId, handleType: 'target' });

	const handleMessage: MessageCallbackFn = (message) => {
		try {
			match(message)
				.with(P.string, (prompt) => {
					setPrompt(prompt);
					setTimeout(() => generateText());
				})
				.with({ type: 'generate', prompt: P.string }, ({ prompt }) => {
					setPrompt(prompt);
					setTimeout(() => generateText());
				})
				.with({ type: 'set', prompt: P.string }, ({ prompt }) => {
					setPrompt(prompt);
				})
				.with({ type: 'bang' }, () => {
					generateText();
				});
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		}
	};

	onMount(() => {
		messageContext.queue.addCallback(handleMessage);
	});

	onDestroy(() => {
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

			const imageNodeId = targetConnections.current.find((conn) =>
				conn.targetHandle?.startsWith('video-in')
			)?.source;

			const llmOutput = await llmFunction(prompt, {
				imageNodeId,
				abortSignal: abortController.signal
			});

			generatedText = llmOutput ?? '';

			messageContext.send(llmOutput);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			isLoading = false;
		}
	}

	function copyToClipboard() {
		navigator.clipboard.writeText(generatedText);
	}
</script>

<ObjectPreviewLayout title="ai.txt" onrun={generateText}>
	{#snippet topHandle()}
		<StandardHandle port="inlet" type="message" total={2} index={0} />
		<StandardHandle
			port="inlet"
			type="video"
			id="0"
			title="Video input (optional)"
			total={2}
			index={1}
		/>
	{/snippet}

	{#snippet preview()}
		<div class="relative w-[300px]">
			<div class="rounded-lg border border-zinc-600 bg-zinc-900">
				{#if isLoading}
					<div class="flex h-full min-h-[100px] items-center justify-center">
						<Icon icon="lucide:loader" class="h-6 w-6 animate-spin text-zinc-300" />
					</div>
				{:else if generatedText}
					<div class="nodrag relative">
						<div
							class="max-h-[200px] min-h-[100px] w-full select-text overflow-y-scroll rounded bg-transparent p-3 font-mono text-xs text-zinc-100 focus:border-zinc-500 focus:outline-none"
						>
							{generatedText}
						</div>

						<button
							onclick={copyToClipboard}
							class="absolute right-1 top-1 rounded p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
							title="Copy to clipboard"
						>
							<Icon icon="lucide:copy" class="h-4 w-4 text-zinc-300" />
						</button>
					</div>
				{:else}
					<div
						class="flex h-full min-h-[100px] items-center justify-center py-2 text-zinc-400"
						ondblclick={generateText}
						role="button"
						tabindex="0"
					>
						{#if data.prompt}
							<span class="font-mono text-xs"
								><span class="text-zinc-300">double click</span> to run</span
							>
						{:else}
							<span class="font-mono text-xs">set a prompt to continue</span>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/snippet}

	{#snippet bottomHandle()}
		<StandardHandle port="outlet" type="message" total={1} index={0} />
	{/snippet}

	{#snippet codeEditor()}
		<div class="w-[350px]">
			<CodeEditor
				value={prompt}
				onchange={(newPrompt) => {
					updateNodeData(nodeId, { ...data, prompt: newPrompt });
				}}
				language="plain"
				placeholder="Write your prompt here..."
				class="nodrag h-64 w-full max-w-[350px] resize-none"
				onrun={generateText}
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
