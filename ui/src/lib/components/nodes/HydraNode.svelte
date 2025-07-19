<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { HydraManager } from '$lib/hydra/HydraManager';
	import CodeEditor from '$lib/components/CodeEditor.svelte';

	let containerElement: HTMLDivElement;
	let hydraManager: HydraManager | null = null;
	let showEditor = $state(false);
	let code = $state(`// Hydra visual synthesizer
// Create oscillating patterns and visual effects

// Basic oscillator with frequency, sync, and offset
osc(4, 0.1, 1.2)
  .color(0.5, 0.8, 1.2)
  .rotate(0.2)
  .modulateScale(osc(8), 0.5)
  .out()

// Try these examples:
// osc(20, 0.1, 0.8).diff(osc(20, 0.05).rotate(Math.PI/2)).out()
// noise(3, 0.1).thresh(0.15, 0.04).modulateRotate(osc(1, 0.5), 0.8).out()
// shape(4, 0.3, 0.01).repeat(2, 2).modulateKaleid(osc(4, -0.5, 0), 1).out()`);

	onMount(() => {
		if (containerElement) {
			hydraManager = new HydraManager(containerElement);
			hydraManager.createHydra({ code });
		}
	});

	onDestroy(() => {
		if (hydraManager) {
			hydraManager.destroy();
		}
	});

	function updateHydra() {
		if (hydraManager) {
			hydraManager.updateCode(code);
		}
	}

	function toggleEditor() {
		showEditor = !showEditor;
	}
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<Handle type="target" position={Position.Top} />
			<Handle type="source" position={Position.Bottom} />

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

			<div bind:this={containerElement} class="rounded-md bg-zinc-900 [&>canvas]:rounded-md"></div>
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
