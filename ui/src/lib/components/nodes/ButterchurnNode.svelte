<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import butterchurn from 'butterchurn';
	import butterchurnPresets from 'butterchurn-presets';

	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import ButterchurnPresetSelect from '../ButterchurnPresetSelect.svelte';
	import { GLSystem } from '$lib/canvas/GLSystem';

	// Get node data from XY Flow - nodes receive their data as props
	let { id: nodeId, data }: { id: string; data: { currentPreset: string } } = $props();

	// Get flow utilities to update node data
	const { updateNodeData } = useSvelteFlow();

	const presets = butterchurnPresets.getPresets();

	let canvasElement: HTMLCanvasElement;
	let showEditor = $state(false);
	let errorMessage = $state<string | null>(null);
	let isPlaying = $state(true);
	let visualizer: any = null;
	let glSystem = GLSystem.getInstance();

	const currentPreset = $derived(data.currentPreset || '');

	let frame = 0;

	const start = () => {
		isPlaying = true;

		function render() {
			visualizer.render();
			glSystem.setBitmapSource(nodeId, canvasElement);
			frame = requestAnimationFrame(render);
		}

		frame = requestAnimationFrame(render);
	};

	const stop = () => {
		isPlaying = false;

		cancelAnimationFrame(frame);
	};

	onMount(() => {
		const audioContext = new AudioContext();

		const [previewWidth, previewHeight] = glSystem.previewSize;
		canvasElement.width = previewWidth;
		canvasElement.height = previewHeight;

		const [outputWidth, outputHeight] = glSystem.outputSize;

		visualizer = butterchurn.createVisualizer(audioContext, canvasElement, {
			width: outputWidth / 2,
			height: outputHeight / 2
		});

		glSystem.upsertNode(nodeId, 'img', {});
	});

	$effect(() => {
		const preset = presets[currentPreset];

		if (!preset) {
			return;
		}

		visualizer.loadPreset(preset, 0.0);
		start();
	});

	onDestroy(() => {
		stop();
		glSystem.removeNode(nodeId);
		visualizer.renderer = null;
		visualizer = null;
	});
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
					<div class="font-mono text-xs font-medium text-zinc-100">butterchurn</div>
				</div>

				<div>
					<button
						class="rounded p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
						onclick={isPlaying ? stop : start}
						title={isPlaying ? 'Pause' : 'Play'}
					>
						<Icon icon={isPlaying ? 'lucide:pause' : 'lucide:play'} class="h-4 w-4 text-zinc-300" />
					</button>

					<button
						class="rounded p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
						onclick={() => (showEditor = !showEditor)}
						title="Edit code"
					>
						<Icon icon="lucide:code" class="h-4 w-4 text-zinc-300" />
					</button>
				</div>
			</div>

			<div class="relative">
				<canvas bind:this={canvasElement} class="rounded-md bg-zinc-900 [&>canvas]:rounded-md"
				></canvas>

				<!-- Error display -->
				{#if errorMessage}
					<div
						class="absolute inset-0 flex items-center justify-center rounded-md bg-red-900/90 p-2"
					>
						<div class="text-center">
							<div class="mt-1 text-xs text-red-200">{errorMessage}</div>
						</div>
					</div>
				{/if}

				<VideoHandle
					type="source"
					position={Position.Bottom}
					id="video-out"
					class="z-1"
					title="Video output"
				/>
			</div>
		</div>
	</div>

	{#if showEditor}
		<div class="relative">
			<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
				<button onclick={() => (showEditor = false)} class="p-1 hover:bg-zinc-700">
					<Icon icon="lucide:x" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
				<ButterchurnPresetSelect
					value={currentPreset}
					onchange={(newPreset) => {
						updateNodeData(nodeId, { ...data, currentPreset: newPreset });
					}}
				/>
			</div>
		</div>
	{/if}
</div>
