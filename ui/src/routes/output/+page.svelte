<script lang="ts">
	import { IpcSystem } from '$lib/canvas/IpcSystem';
	import { onMount } from 'svelte';

	let canvas: HTMLCanvasElement;
	let bitmapRendererContext: ImageBitmapRenderingContext;

	onMount(() => {
		canvas.width = window.visualViewport?.width ?? window.innerWidth;
		canvas.height = window.visualViewport?.height ?? window.innerHeight;
		canvas.style.width = `100%`;
		canvas.style.height = `100%`;

		bitmapRendererContext = canvas.getContext('bitmaprenderer')!;

		window.addEventListener('message', (event) => {
			if (event.data.type === 'renderOutput') {
				bitmapRendererContext.transferFromImageBitmap(event.data.bitmap);
			}
		});
	});
</script>

<div>
	<canvas id="output" bind:this={canvas}></canvas>
</div>
