<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import butterchurn from 'butterchurn';
	import butterchurnPresets from 'butterchurn-presets';

	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import { VideoSystem } from '$lib/video/VideoSystem';
	import ButterchurnPresetSelect from '../ButterchurnPresetSelect.svelte';

	// Get node data from XY Flow - nodes receive their data as props
	let { id: nodeId }: { id: string } = $props();

	const presets = butterchurnPresets.getPresets();
	const firstPreset = '_Mig_049';

	let videoSystem: VideoSystem;
	let canvasElement: HTMLCanvasElement;
	let showEditor = $state(false);
	let errorMessage = $state<string | null>(null);
	let isPlaying = $state(true);
	let visualizer: any = null;
	let currentPreset: string = $state(firstPreset);

	let frame = 0;

	const start = () => {
		isPlaying = true;

		function render() {
			visualizer.render();
			frame = requestAnimationFrame(render);
		}

		frame = requestAnimationFrame(render);
	};

	const stop = () => {
		isPlaying = false;

		cancelAnimationFrame(frame);
	};

	onMount(() => {
		videoSystem = VideoSystem.getInstance();
		videoSystem.registerVideoSource(nodeId, canvasElement);

		const width = 200 * window.devicePixelRatio;
		const height = 200 * window.devicePixelRatio;

		const audioContext = new AudioContext();

		const ctx = { width, height };
		visualizer = butterchurn.createVisualizer(audioContext, canvasElement, ctx);
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
		videoSystem.unregisterNode(nodeId);
		visualizer.renderer = null;
		visualizer = null;
	});

	function toggleEditor() {
		showEditor = !showEditor;
	}
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
						class="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700"
						onclick={isPlaying ? stop : start}
						title={isPlaying ? 'Pause' : 'Play'}
					>
						<Icon icon={isPlaying ? 'lucide:pause' : 'lucide:play'} class="h-4 w-4 text-zinc-300" />
					</button>

					<button
						class="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700"
						onclick={toggleEditor}
						title="Edit code"
					>
						<Icon icon="lucide:code" class="h-4 w-4 text-zinc-300" />
					</button>
				</div>
			</div>

			<div class="relative">
				<Handle type="target" position={Position.Top} />

				<VideoHandle
					type="target"
					position={Position.Top}
					id="video-in"
					class="!left-8"
					title="Video input"
				/>

				<canvas
					bind:this={canvasElement}
					class="rounded-md bg-zinc-900 [&>canvas]:rounded-md"
					width="200"
					height="200"
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

				<Handle type="source" position={Position.Bottom} class="absolute" />

				<VideoHandle
					type="source"
					position={Position.Bottom}
					id="video-out"
					class="!left-8"
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
				<ButterchurnPresetSelect bind:value={currentPreset} />
			</div>
		</div>
	{/if}
</div>
