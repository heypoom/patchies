<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import StrudelEditor from '$lib/components/StrudelEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { Message } from '$lib/messages/MessageSystem';
	import { match } from 'ts-pattern';

	// Get node data from XY Flow - nodes receive their data as props
	let { id: nodeId, data }: { id: string; data: { code: string } } = $props();

	// Get flow utilities to update node data
	const { updateNodeData } = useSvelteFlow();

	let strudelEditor: StrudelEditor | null = null;
	let messageContext: MessageContext;
	let errorMessage = $state<string | null>(null);
	let isPlaying = $state(false);
	let isInitialized = $state(false);

	const code = $derived(data.code || '');
	const setCode = (newCode: string) => {
		updateNodeData(nodeId, { ...data, code: newCode });
		strudelEditor?.editor?.setCode(newCode);
	};

	function handleMessage(message: Message) {
		if (typeof message.data === 'string') {
			setCode(message.data);
			return;
		}

		match(message.data.type)
			.with('bang', () => {
				evaluate();
			})
			.with('run', () => {
				evaluate();
			})
			.with('set', () => {
				setCode(message.data.code);
			})
			.with('stop', () => {
				stop();
			});
	}

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);

		// Wait for the StrudelEditor to be ready
		setTimeout(() => {
			if (strudelEditor?.editor) {
				isInitialized = true;

				// @ts-expect-error -- for debugging
				window.strudel = strudelEditor.editor;
			}
		}, 1000);
	});

	onDestroy(() => {
		stop();

		if (messageContext) {
			messageContext.queue.removeCallback(handleMessage);
			messageContext.destroy();
		}
	});

	function stop() {
		if (strudelEditor?.editor) {
			try {
				strudelEditor.editor.stop();
				isPlaying = false;
				errorMessage = null;
			} catch (error) {
				errorMessage = error instanceof Error ? error.message : String(error);
			}
		}
	}

	function evaluate() {
		if (strudelEditor?.editor) {
			try {
				strudelEditor.editor.evaluate();
				errorMessage = null;
			} catch (error) {
				errorMessage = error instanceof Error ? error.message : String(error);
				isPlaying = false;
			}
		}
	}

	function handleUpdateState(state: any) {
		isPlaying = state.started;
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
								class="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700"
								onclick={stop}
								title="Stop"
							>
								<Icon icon="lucide:square" class="h-4 w-4 text-zinc-300" />
							</button>
						{:else}
							<button
								class="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700"
								onclick={evaluate}
								title="Play"
							>
								<Icon icon="lucide:play" class="h-4 w-4 text-zinc-300" />
							</button>
						{/if}
					{/if}
				</div>
			</div>

			<div class="relative">
				<Handle
					type="target"
					position={Position.Top}
					id={`strudel-${nodeId}-inlet`}
					class="nodrag !-top-2 z-1"
				/>

				<div class="flex w-full items-center justify-center rounded-md bg-zinc-900">
					<div class="nodrag">
						<StrudelEditor
							{code}
							bind:this={strudelEditor}
							onUpdateState={handleUpdateState}
							onchange={(newCode) => {
								updateNodeData(nodeId, { ...data, code: newCode });
							}}
							class="w-full"
						/>
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
			</div>
		</div>
	</div>
</div>
