<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { isBackgroundOutputCanvasEnabled } from '../../stores/canvas.store';
	import { VideoSystem } from '$lib/video/VideoSystem';

	let canvasElement: HTMLCanvasElement;
	let videoSystem = VideoSystem.getInstance();
	let frameHandle: number | null = null;

	function renderFrame() {
		const source = videoSystem.outputNodeCanvas;

		if (source) {
			const canvas = canvasElement.getContext('2d');
			canvas?.drawImage(source, 0, 0);
			frameHandle = requestAnimationFrame(renderFrame);
		} else {
			kill();
			$isBackgroundOutputCanvasEnabled = false;
		}
	}

	const kill = () => {
		if (frameHandle) {
			cancelAnimationFrame(frameHandle);
			frameHandle = null;
		}
	};

	const start = () => {
		kill();
		frameHandle = requestAnimationFrame(renderFrame);
	};

	$effect(() => {
		if ($isBackgroundOutputCanvasEnabled) {
			start();
		} else {
			kill();
		}
	});

	onDestroy(() => {
		kill();
	});
</script>

<div
	class={`pointer-events-none z-[-1] h-[100%] w-[100%] cursor-none ${
		$isBackgroundOutputCanvasEnabled ? '' : 'hidden'
	}`}
>
	<canvas bind:this={canvasElement} class="h-800 w-800"></canvas>
</div>
