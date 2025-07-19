<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { P5Manager } from '$lib/p5/P5Manager';
	import CodeEditor from '$lib/components/CodeEditor.svelte';

	let containerElement: HTMLDivElement;
	let p5Manager: P5Manager | null = null;
	let showEditor = $state(false);
	let code = $state(`function setup() {
  createCanvas(200, 200);
}

function draw() {
  background(100, 200, 300);
  fill(255, 255, 100);
  ellipse(100, 100, 80, 80);
}`);

	onMount(() => {
		if (containerElement) {
			p5Manager = new P5Manager(containerElement);
			p5Manager.createSketch({ code });
		}
	});

	onDestroy(() => {
		if (p5Manager) {
			p5Manager.destroy();
		}
	});

	function updateSketch() {
		if (p5Manager) {
			p5Manager.updateCode(code);
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
					<div class="font-mono text-xs font-medium text-zinc-100">p5.canvas</div>
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
				<button onclick={updateSketch} class="p-1 hover:bg-zinc-700">
					<Icon icon="lucide:play" class="h-4 w-4 text-zinc-300" />
				</button>

				<button onclick={() => (showEditor = false)} class="p-1 hover:bg-zinc-700">
					<Icon icon="lucide:x" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
				<CodeEditor
					bind:value={code}
					language="javascript"
					placeholder="Write your p5.js code here..."
					class="nodrag h-64 w-full resize-none"
					onrun={updateSketch}
				/>
			</div>
		</div>
	{/if}
</div>

<style>
	:global(.svelte-flow__handle) {
	}

	:global(.svelte-flow__handle.svelte-flow__handle-top) {
		top: 0;
	}

	:global(.svelte-flow__handle.svelte-flow__handle-bottom) {
	}
</style>
