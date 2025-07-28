<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import { createLLMFunction } from '$lib/ai/google';
	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import { VideoSystem } from '$lib/video/VideoSystem';

	// Get node data from XY Flow - nodes receive their data as props
	let { id: nodeId, data }: { id: string; data: { code: string } } = $props();

	// Get flow utilities to update node data
	const { updateNodeData } = useSvelteFlow();

	let messageContext: MessageContext;
	let videoSystem: VideoSystem;
	let videoCanvases: HTMLCanvasElement[] = $state([]);
	let isRunning = $state(false);

	let showEditor = $state(false);
	let consoleOutput = $state<string[]>([]);

	const code = $derived(data.code || '');

	onMount(() => {
		// Initialize message context
		messageContext = new MessageContext(nodeId);

		// Initialize video system
		videoSystem = VideoSystem.getInstance();

		// Subscribe to video canvas sources
		videoSystem.onVideoCanvas(nodeId, (canvases) => {
			videoCanvases = canvases;
		});

		// Execute code on mount
		executeCode();
	});

	onDestroy(() => {
		// Clean up message context
		if (messageContext) {
			messageContext.destroy();
		}

		// Clean up video system
		if (videoSystem) {
			videoSystem.unregisterNode(nodeId);
		}
	});

	async function executeCode() {
		isRunning = true;

		// Clear previous output
		consoleOutput = [];

		// Don't recreate message context - just clear intervals to avoid duplicates
		if (messageContext) {
			// Clear only intervals, keep the message context alive for connections
			messageContext.clearIntervals();
		}

		// Create a custom console that captures output
		const customConsole = {
			log: (...args: any[]) => {
				const message = args
					.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
					.join(' ');
				consoleOutput = [...consoleOutput, message];
			},
			error: (...args: any[]) => {
				const message = args.map((arg) => String(arg)).join(' ');
				consoleOutput = [...consoleOutput, `ERROR: ${message}`];
			},
			warn: (...args: any[]) => {
				const message = args.map((arg) => String(arg)).join(' ');
				consoleOutput = [...consoleOutput, `WARN: ${message}`];
			}
		};

		try {
			// Get message system context
			const messageSystemContext = messageContext.getContext();

			// Create a function with the user code, injecting message constructs and video features
			const functionParams = [
				'console',
				'send',
				'onMessage',
				'interval',
				'llm',
				'getCanvas',
				'videoCanvases'
			];
			const functionArgs = [
				customConsole,
				messageSystemContext.send,
				messageSystemContext.onMessage,
				messageSystemContext.interval,
				createLLMFunction(),
				getCanvas,
				videoCanvases
			];

			const userFunction = new Function(
				...functionParams,
				`
				const inner = async () => {
					var recv = receive = onMessage; // alias
				
					${code}
				}

				return inner()
			`
			);

			// Execute with our custom console and message system
			await userFunction(...functionArgs);
		} catch (error) {
			consoleOutput = [
				...consoleOutput,
				`ERROR: ${error instanceof Error ? error.message : String(error)}`
			];
		} finally {
			isRunning = false;
		}
	}

	function toggleEditor() {
		showEditor = !showEditor;
	}

	function clearConsole() {
		consoleOutput = [];
	}

	function getCanvas() {
		// Return the first video canvas if available
		return videoCanvases.length > 0 ? videoCanvases[0] : null;
	}
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
					<div class="font-mono text-xs font-medium text-zinc-100">js</div>
				</div>

				<button
					class="rounded p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
					onclick={toggleEditor}
					title="Edit code"
				>
					<Icon icon="lucide:code" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="relative min-w-[280px] rounded-md border border-zinc-600 bg-zinc-900 p-3">
				<Handle type="target" position={Position.Top} />
				<VideoHandle
					type="target"
					position={Position.Top}
					id="video-in"
					title="Video input"
					class="!left-30"
				/>

				<div class="mb-2 flex items-center justify-between">
					<span class="font-mono text-xs text-zinc-400">Console</span>

					<div class="flex gap-1">
						<button
							onclick={executeCode}
							class={['rounded p-1 hover:bg-zinc-700', isRunning && 'animate-spin opacity-30']}
							title="Run code"
							aria-disabled={isRunning}
						>
							<Icon
								icon={isRunning ? 'lucide:loader' : 'lucide:play'}
								class="h-3 w-3 text-zinc-300"
							/>
						</button>
						<button
							onclick={clearConsole}
							class="rounded p-1 hover:bg-zinc-700"
							title="Clear console"
						>
							<Icon icon="lucide:trash-2" class="h-3 w-3 text-zinc-300" />
						</button>
					</div>
				</div>

				<div
					class="nodrag h-32 cursor-text overflow-y-auto rounded border border-zinc-700 bg-zinc-800 p-2 font-mono text-xs"
				>
					{#if consoleOutput.length === 0}
						<div class="italic text-zinc-500">Run your code to see results.</div>
					{:else}
						{#each consoleOutput as line}
							<div class="mb-1 whitespace-pre-wrap text-zinc-100">{line}</div>
						{/each}
					{/if}
				</div>

				<Handle type="source" position={Position.Bottom} />
			</div>
		</div>
	</div>

	{#if showEditor}
		<div class="relative">
			<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
				<button onclick={() => (showEditor = false)} class="rounded p-1 hover:bg-zinc-700">
					<Icon icon="lucide:x" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
				<CodeEditor
					value={code}
					onchange={(newCode) => {
						updateNodeData(nodeId, { ...data, code: newCode });
					}}
					language="javascript"
					placeholder="Write your JavaScript code here..."
					class="nodrag h-64 w-full resize-none"
					onrun={executeCode}
				/>
			</div>
		</div>
	{/if}
</div>
