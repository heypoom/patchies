<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { StrudelManager } from '$lib/strudel/StrudelManager';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';

	// Get node data from XY Flow - nodes receive their data as props
	let { id: nodeId }: { id: string } = $props();

	let strudelManager: StrudelManager | null = null;
	let messageContext: MessageContext;
	let showEditor = $state(false);
	let errorMessage = $state<string | null>(null);
	let isPlaying = $state(false);
	let isInitialized = $state(false);
	let code = $state(`note("c a f e").jux(rev)`);

	onMount(() => {
		// Initialize message context
		messageContext = new MessageContext(nodeId);

		// Wait a tick to ensure everything is initialized
		setTimeout(() => {
			// Create a dummy container element for StrudelManager
			const container = document.createElement('div');
			strudelManager = new StrudelManager(container);

			// Check initialization status periodically
			const checkInit = setInterval(() => {
				if (strudelManager?.getIsInitialized()) {
					isInitialized = true;
					clearInterval(checkInit);
				}
			}, 100);

			// Clean up check after 10 seconds
			setTimeout(() => clearInterval(checkInit), 10000);
		}, 0);
	});

	onDestroy(() => {
		if (strudelManager) {
			strudelManager.destroy();
		}
		if (messageContext) {
			messageContext.destroy();
		}
	});

	async function updateCode() {
		if (strudelManager && messageContext && isInitialized) {
			try {
				await strudelManager.updateCode({
					code,
					messageContext: messageContext.getContext()
				});
				// Clear any previous errors on successful update
				errorMessage = null;
				isPlaying = strudelManager.getIsPlaying();
			} catch (error) {
				// Capture evaluation errors
				errorMessage = error instanceof Error ? error.message : String(error);
				isPlaying = false;
			}
		}
	}

	function toggleEditor() {
		showEditor = !showEditor;
	}

	function stop() {
		if (strudelManager) {
			strudelManager.stop();
			isPlaying = false;
		}
	}

	function play() {
		updateCode();
	}
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
					<div class="font-mono text-xs font-medium text-zinc-100">strudel</div>
				</div>

				<div class="flex items-center gap-1">
					<!-- Play/Stop button -->
					{#if isInitialized}
						{#if isPlaying}
							<button
								class="rounded p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
								onclick={stop}
								title="Stop"
							>
								<Icon icon="lucide:square" class="h-4 w-4 text-zinc-300" />
							</button>
						{:else}
							<button
								class="rounded p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
								onclick={play}
								title="Play"
							>
								<Icon icon="lucide:play" class="h-4 w-4 text-zinc-300" />
							</button>
						{/if}
					{/if}

					<button
						class="rounded p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
						onclick={toggleEditor}
						title="Edit code"
					>
						<Icon icon="lucide:code" class="h-4 w-4 text-zinc-300" />
					</button>
				</div>
			</div>

			<div class="relative">
				<Handle type="target" position={Position.Top} />

				<div class="flex h-20 w-20 items-center justify-center rounded-md bg-zinc-900">
					{#if !isInitialized}
						<div class="text-center">
							<Icon icon="lucide:loader-2" class="mx-auto h-6 w-6 animate-spin text-zinc-400" />
							<div class="mt-1 text-xs text-zinc-400">Initializing Strudel...</div>
						</div>
					{:else if isPlaying}
						<div class="text-center">
							<Icon icon="lucide:music" class="mx-auto h-6 w-6 text-green-400" />
							<div class="mt-1 text-xs text-green-400">Playing</div>
						</div>
					{:else}
						<div class="text-center">
							<Icon icon="lucide:music" class="mx-auto h-6 w-6 text-zinc-400" />
							<div class="mt-1 text-xs text-zinc-400">Ready</div>
						</div>
					{/if}
				</div>

				<!-- Error display -->
				{#if errorMessage}
					<div
						class="absolute inset-0 flex items-center justify-center rounded-md bg-red-900/90 p-2"
					>
						<div class="text-center">
							<div class="text-xs font-medium text-red-100">Strudel Error:</div>
							<div class="mt-1 text-xs text-red-200">{errorMessage}</div>
						</div>
					</div>
				{/if}

				<Handle type="source" position={Position.Bottom} class="absolute" />
			</div>
		</div>
	</div>

	{#if showEditor}
		<div class="relative">
			<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
				<button onclick={play} class="p-1 hover:bg-zinc-700" disabled={!isInitialized}>
					<Icon icon="lucide:play" class="h-4 w-4 text-zinc-300" />
				</button>

				<button onclick={stop} class="p-1 hover:bg-zinc-700" disabled={!isInitialized}>
					<Icon icon="lucide:square" class="h-4 w-4 text-zinc-300" />
				</button>

				<button onclick={() => (showEditor = false)} class="p-1 hover:bg-zinc-700">
					<Icon icon="lucide:x" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
				<CodeEditor
					bind:value={code}
					language="javascript"
					placeholder="Write your Strudel code here..."
					class="nodrag h-32 w-full resize-none"
					onrun={play}
				/>
			</div>
		</div>
	{/if}
</div>
