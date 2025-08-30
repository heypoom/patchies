<script lang="ts">
	import { Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';

	import butterchurn from 'butterchurn';
	import butterchurnPresets from 'butterchurn-presets';

	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import ButterchurnPresetSelect from '../ButterchurnPresetSelect.svelte';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';
	import { AudioSystem } from '$lib/audio/AudioSystem';
	import { Handle } from '@xyflow/svelte';

	let {
		id: nodeId,
		data,
		selected
	}: { id: string; data: { currentPreset: string }; selected: boolean } = $props();

	// Get flow utilities to update node data
	const { updateNodeData } = useSvelteFlow();

	const presets = butterchurnPresets.getPresets();

	let canvasElement = $state<HTMLCanvasElement | undefined>();
	let errorMessage = $state<string | null>(null);
	let isPlaying = $state(true);
	let visualizer: any = null;
	let glSystem = GLSystem.getInstance();
	let audioSystem = AudioSystem.getInstance();

	let frame = 0;

	const start = () => {
		isPlaying = true;

		function render() {
			if (!visualizer) return;

			visualizer.render();

			if (canvasElement && glSystem.hasOutgoingVideoConnections(nodeId)) {
				glSystem.setBitmapSource(nodeId, canvasElement);
			}

			frame = requestAnimationFrame(render);
		}

		frame = requestAnimationFrame(render);
	};

	const stop = () => {
		isPlaying = false;

		cancelAnimationFrame(frame);
	};

	onMount(() => {
		if (canvasElement) {
			const [previewWidth, previewHeight] = glSystem.previewSize;
			canvasElement.width = previewWidth;
			canvasElement.height = previewHeight;

			const [outputWidth, outputHeight] = glSystem.outputSize;

			visualizer = butterchurn.createVisualizer(audioSystem.audioContext, canvasElement, {
				width: outputWidth / 2,
				height: outputHeight / 2
			});
		}

		audioSystem.createAudioObject(nodeId, 'gain~', [, 1]);
		glSystem.upsertNode(nodeId, 'img', {});

		const audioObject = audioSystem.nodesById.get(nodeId);

		if (audioObject && visualizer) {
			visualizer.connectAudio(audioObject.node);
		}
	});

	$effect(() => {
		const preset = presets[data.currentPreset];

		if (!preset) {
			return;
		}

		visualizer.loadPreset(preset, 0.0);
		start();
	});

	onDestroy(() => {
		stop();
		glSystem.removeNode(nodeId);
		audioSystem.removeAudioObject(nodeId);
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
	bind:previewCanvas={canvasElement}
	{selected}
>
	{#snippet topHandle()}
		<Handle
			type="target"
			position={Position.Top}
			id="audio-in"
			class="z-1 !bg-blue-500"
			title="Audio input"
		/>
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
			value={data.currentPreset}
			onchange={(nextPreset) => {
				updateNodeData(nodeId, { ...data, currentPreset: nextPreset });
			}}
		/>
	{/snippet}
</CanvasPreviewLayout>
