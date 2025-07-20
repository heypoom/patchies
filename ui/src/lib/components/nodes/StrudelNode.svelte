<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import '@strudel/repl';
	import { MessageContext } from '$lib/messages/MessageContext';

	// Get node data from XY Flow - nodes receive their data as props
	let { id: nodeId }: { id: string } = $props();

	let strudelElement: any = null;
	let messageContext: MessageContext;
	let showEditor = $state(false);
	let errorMessage = $state<string | null>(null);
	let isPlaying = $state(false);
	let isInitialized = $state(false);
	let code = $state(`note("c a f e").jux(rev)`);

	onMount(() => {
		messageContext = new MessageContext(nodeId);

		if (strudelElement && strudelElement.editor) {
			isInitialized = true;

			const editor = strudelElement.editor;
			editor.setCode(code);
			editor.setFontFamily('Monaco, Menlo, monospace');

			// @ts-expect-error -- for debugging
			window.strudel = strudelElement.editor;
		}
	});

	onDestroy(() => {
		if (strudelElement && strudelElement.editor) {
			strudelElement.editor.stop();
		}

		if (messageContext) {
			messageContext.destroy();
		}
	});

	function toggleEditor() {
		showEditor = !showEditor;
	}

	function stop() {
		if (strudelElement && strudelElement.editor) {
			try {
				strudelElement.editor.stop();
				isPlaying = false;
				errorMessage = null;
			} catch (error) {
				errorMessage = error instanceof Error ? error.message : String(error);
			}
		}
	}

	function play() {
		if (strudelElement && strudelElement.editor) {
			try {
				strudelElement.editor.evaluate();
				isPlaying = true;
				errorMessage = null;
			} catch (error) {
				errorMessage = error instanceof Error ? error.message : String(error);
				isPlaying = false;
			}
		}
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
				</div>
			</div>

			<div class="relative">
				<Handle type="target" position={Position.Top} />

				<div class="flex w-full items-center justify-center rounded-md bg-zinc-900">
					<div class="nodrag">
						<strudel-editor {code} bind:this={strudelElement}></strudel-editor>
					</div>
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
</div>
