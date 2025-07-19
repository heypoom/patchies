<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { JSCanvasManager } from '$lib/canvas/JSCanvasManager';
	import CodeEditor from '$lib/components/CodeEditor.svelte';

	let containerElement: HTMLDivElement;
	let canvasManager: JSCanvasManager | null = null;
	let showEditor = $state(false);
	let code = $state(`// Clear canvas with a background color
canvas.fillStyle = '#18181b';
canvas.fillRect(0, 0, width, height);

// Draw a simple animated circle
function animate() {
	// Clear canvas
	canvas.clearRect(0, 0, width, height);
	
	// Background
	canvas.fillStyle = '#18181b';
	canvas.fillRect(0, 0, width, height);
	
	// Animated circle
	const time = Date.now() * 0.002;
	const x = width/2 + Math.cos(time) * 50;
	const y = height/2 + Math.sin(time) * 30;
	
	canvas.fillStyle = '#4ade80';
	canvas.beginPath();
	canvas.arc(x, y, 20, 0, Math.PI * 2);
	canvas.fill();
	
	// Continue animation
	requestAnimationFrame(animate);
}

// Start animation
animate();

// Try these examples:
// canvas.strokeStyle = '#60a5fa';
// canvas.lineWidth = 3;
// canvas.strokeRect(10, 10, width-20, height-20);`);

	onMount(() => {
		if (containerElement) {
			canvasManager = new JSCanvasManager(containerElement);
			canvasManager.createCanvas({ code });
		}
	});

	onDestroy(() => {
		if (canvasManager) {
			canvasManager.destroy();
		}
	});

	function updateCanvas() {
		if (canvasManager) {
			canvasManager.updateCode(code);
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
					<div class="font-mono text-xs font-medium text-zinc-100">js.canvas</div>
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
				<button onclick={updateCanvas} class="rounded p-1 hover:bg-zinc-700">
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
					placeholder="Write your Canvas API code here..."
					class="nodrag h-64 w-full resize-none"
					onrun={updateCanvas}
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
