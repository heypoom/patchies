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

<div class="flex gap-x-4">
	<div
		class="group relative min-w-[220px] rounded-lg border border-zinc-600 bg-zinc-900 p-3 shadow-lg"
	>
		<Handle type="target" position={Position.Top} />

		<div class="flex flex-col gap-2">
			<div class="flex items-center justify-between">
				<span class="font-mono text-xs font-medium text-zinc-100">p5.canvas</span>
				<button
					class="rounded p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
					onclick={toggleEditor}
					title="Edit code"
				>
					<Icon icon="lucide:code" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div
				bind:this={containerElement}
				class="rounded-md border border-zinc-600 bg-zinc-900 [&>canvas]:rounded-md"
			></div>
		</div>

		<Handle type="source" position={Position.Bottom} />
	</div>

	<div>
		{#if showEditor}
			<div class="rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
				<div class="relative">
					<div class="flex justify-end p-1">
						<button onclick={updateSketch} class="rounded p-1 hover:bg-zinc-700">
							<Icon icon="lucide:play" class="h-4 w-4 text-zinc-300" />
						</button>

						<button onclick={() => (showEditor = false)} class="rounded p-[4px] hover:bg-zinc-700">
							<Icon icon="lucide:x" class="h-4 w-4 text-zinc-300" />
						</button>
					</div>

					<CodeEditor
						bind:value={code}
						language="javascript"
						placeholder="Write your p5.js code here..."
						class="h-64 w-full resize-none"
					/>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	:global(.svelte-flow__handle) {
		background: rgb(156 163 175) !important;
		border: 2px solid rgb(75 85 99) !important;
		width: 8px !important;
		height: 8px !important;
	}

	:global(.svelte-flow__handle.svelte-flow__handle-top) {
		top: -4px !important;
	}

	:global(.svelte-flow__handle.svelte-flow__handle-bottom) {
		bottom: -4px !important;
	}
</style>
