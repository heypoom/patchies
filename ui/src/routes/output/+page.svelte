<script lang="ts">
	import { IpcSystem } from '$lib/canvas/IpcSystem';
	import { onMount } from 'svelte';

	let canvas: HTMLCanvasElement;
	let bitmapRendererContext: ImageBitmapRenderingContext;
	let ipcSystem: IpcSystem;

	onMount(() => {
		canvas.width = window.visualViewport?.width ?? window.innerWidth;
		canvas.height = window.visualViewport?.height ?? window.innerHeight;
		canvas.style.width = `100%`;
		canvas.style.height = `100%`;

		bitmapRendererContext = canvas.getContext('bitmaprenderer')!;

		ipcSystem = IpcSystem.getInstance();
		ipcSystem.screen = 'output';

		ipcSystem.onAckScreenRegistration = () => {
			console.log('ack screen registration');
		};

		ipcSystem.onOutput = (bitmap) => {
			console.log('output!');
			bitmapRendererContext.transferFromImageBitmap(bitmap);
		};

		ipcSystem.send({ type: 'outputScreenRegistered' });
	});
</script>

<div>
	<canvas id="output" bind:this={canvas}></canvas>
</div>
