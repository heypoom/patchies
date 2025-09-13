<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';

	let butterchurn;
	let butterchurnPresets;
	let presets: Record<string, unknown> = $state({});

	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import ButterchurnPresetSelect from '../ButterchurnPresetSelect.svelte';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';
	import { AudioSystem } from '$lib/audio/AudioSystem';

	let {
		id: nodeId,
		data,
		selected
	}: { id: string; data: { currentPreset: string }; selected: boolean } = $props();

	const { updateNodeData } = useSvelteFlow();

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

	onMount(async () => {
		// @ts-expect-error -- no typedefs
		butterchurn = (await import('butterchurn')).default;

		// @ts-expect-error -- no typedefs
		butterchurnPresets = (await import('butterchurn-presets')).default;

		presets = butterchurnPresets.getPresets();

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

		const preset = presets[data.currentPreset];
		if (!preset) return;

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
		<StandardHandle port="inlet" type="audio" id="0" title="Audio input" total={1} index={0} />
	{/snippet}

	{#snippet bottomHandle()}
		<StandardHandle port="outlet" type="video" id="0" title="Video output" total={1} index={0} />
	{/snippet}

	{#snippet codeEditor()}
		<ButterchurnPresetSelect
			value={data.currentPreset}
			onchange={(nextPreset) => {
				updateNodeData(nodeId, { currentPreset: nextPreset });

				const preset = presets[nextPreset];
				if (!preset) return;

				visualizer.loadPreset(preset, 0.0);
				start();
			}}
		/>
	{/snippet}
</CanvasPreviewLayout>
