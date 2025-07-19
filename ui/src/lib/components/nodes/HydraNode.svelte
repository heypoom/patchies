<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { HydraManager } from '$lib/hydra/HydraManager';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';

	// Get node data from XY Flow - nodes receive their data as props
	let { id: nodeId }: { id: string } = $props();

	let containerElement: HTMLDivElement;
	let hydraManager: HydraManager | null = null;
	let messageContext: MessageContext;
	let showEditor = $state(false);
	let code = $state(`osc(20, 0.1, 0.8)
  .diff(osc(20, 0.05)
  .rotate(Math.PI/2))
  .out()

// Try these examples:
// noise(3, 0.1).thresh(0.15, 0.04).modulateRotate(osc(1, 0.5), 0.8).out()
// shape(4, 0.3, 0.01).repeat(2, 2).modulateKaleid(osc(4, -0.5, 0), 1).out()`);

	onMount(() => {
		// Initialize message context
		messageContext = new MessageContext(nodeId);

		if (containerElement) {
			hydraManager = new HydraManager(containerElement, {
				code,
				messageContext: messageContext.getContext()
			});
		}
	});

	onDestroy(() => {
		if (hydraManager) {
			hydraManager.destroy();
		}
		if (messageContext) {
			messageContext.destroy();
		}
	});

	function updateHydra() {
		if (hydraManager && messageContext) {
			// Clear intervals to avoid duplicates
			messageContext.clearIntervals();
			hydraManager.updateCode({
				code,
				messageContext: messageContext.getContext()
			});
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
					<div class="font-mono text-xs font-medium text-zinc-100">hydra</div>
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
				<Handle type="target" position={Position.Top} />

				<div
					bind:this={containerElement}
					class="rounded-md bg-zinc-900 [&>canvas]:rounded-md"
				></div>

				<Handle type="source" position={Position.Bottom} />
			</div>
		</div>
	</div>

	{#if showEditor}
		<div class="relative">
			<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
				<button onclick={updateHydra} class="rounded p-1 hover:bg-zinc-700">
					<Icon icon="lucide:play" class="h-4 w-4 text-zinc-300" />
				</button>

				<button onclick={() => (showEditor = false)} class="rounded p-1 hover:bg-zinc-700">
					<Icon icon="lucide:x" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
				<CodeEditor
					bind:value={code}
					language="javascript"
					placeholder="Write your Hydra code here..."
					class="nodrag h-64 w-full resize-none"
					onrun={updateHydra}
				/>
			</div>
		</div>
	{/if}
</div>
