<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';

	// Get node data from XY Flow - nodes receive their data as props
	let { id: nodeId }: { id: string } = $props();

	let messageContext: MessageContext;

	let showEditor = $state(false);
	let code = $state(`console.log(1 + 1)`);

	let consoleOutput = $state<string[]>([]);

	onMount(() => {
		// Initialize message context
		messageContext = new MessageContext(nodeId);

		// Execute code on mount
		executeCode();
	});

	onDestroy(() => {
		// Clean up message context
		if (messageContext) {
			messageContext.destroy();
		}
	});

	function executeCode() {
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

			// Create a function with the user code, injecting message constructs
			const functionParams = ['console', 'send', 'onMessage', 'interval'];
			const functionArgs = [
				customConsole,
				messageSystemContext.send,
				messageSystemContext.onMessage,
				messageSystemContext.interval
			];

			const userFunction = new Function(...functionParams, code);
			// Execute with our custom console and message system
			userFunction(...functionArgs);
		} catch (error) {
			consoleOutput = [
				...consoleOutput,
				`ERROR: ${error instanceof Error ? error.message : String(error)}`
			];
		}
	}

	function toggleEditor() {
		showEditor = !showEditor;
	}

	function clearConsole() {
		consoleOutput = [];
	}
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<Handle type="target" position={Position.Top} />
			<Handle type="source" position={Position.Bottom} />

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

			<div class="min-w-[280px] rounded-md border border-zinc-600 bg-zinc-900 p-3">
				<div class="mb-2 flex items-center justify-between">
					<span class="font-mono text-xs text-zinc-400">Console</span>

					<div class="flex gap-1">
						<button onclick={executeCode} class="rounded p-1 hover:bg-zinc-700" title="Run code">
							<Icon icon="lucide:play" class="h-3 w-3 text-zinc-300" />
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
						<div class="italic text-zinc-500">No output yet. Run your code to see results.</div>
					{:else}
						{#each consoleOutput as line}
							<div class="mb-1 whitespace-pre-wrap text-zinc-100">{line}</div>
						{/each}
					{/if}
				</div>
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
					bind:value={code}
					language="javascript"
					placeholder="Write your JavaScript code here..."
					class="nodrag h-64 w-full resize-none"
					onrun={executeCode}
				/>
			</div>
		</div>
	{/if}
</div>

<style>
	:global(.svelte-flow__handle) {
		background: rgb(156 163 175) !important;
		border: 2px solid rgb(75 85 99) !important;
		width: 8px !important;
		height: 8px !important;
	}

	:global(.svelte-flow__handle.svelte-flow__handle-top) {
		top: 0 !important;
	}

	:global(.svelte-flow__handle.svelte-flow__handle-bottom) {
		bottom: 0 !important;
	}
</style>
