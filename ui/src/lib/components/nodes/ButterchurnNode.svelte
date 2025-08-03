<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import butterchurn from 'butterchurn';
	import butterchurnPresets from 'butterchurn-presets';

	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import ButterchurnPresetSelect from '../ButterchurnPresetSelect.svelte';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';

	// Get node data from XY Flow - nodes receive their data as props
	let { id: nodeId, data }: { id: string; data: { currentPreset: string } } = $props();

	// Get flow utilities to update node data
	const { updateNodeData } = useSvelteFlow();

	const presets = butterchurnPresets.getPresets();

	let canvasElement: HTMLCanvasElement;
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

<CanvasPreviewLayout
	title="butterchurn"
	onPlaybackToggle={isPlaying ? stop : start}
	paused={!isPlaying}
	showPauseButton={true}
	{errorMessage}
>
	{#snippet preview()}
		<canvas bind:this={canvasElement} class="rounded-md bg-zinc-900 [&>canvas]:rounded-md"></canvas>
	{/snippet}

	{#snippet bottomHandle()}
		<VideoHandle
			type="source"
			position={Position.Bottom}
			id="video-out"
			class="z-1"
			title="Video output"
		/>
	{/snippet}

	{#snippet codeEditor()}
		<ButterchurnPresetSelect
			value={currentPreset}
			onchange={(newPreset) => {
				updateNodeData(nodeId, { ...data, currentPreset: newPreset });
			}}
		/>
	{/snippet}
</CanvasPreviewLayout>
