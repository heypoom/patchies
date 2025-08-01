<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { isBackgroundOutputCanvasEnabled } from '../../stores/canvas.store';
	import { GLSystem } from '$lib/canvas/GLSystem';

	let outputCanvasElement: HTMLCanvasElement;
	let bitmapContext: ImageBitmapRenderingContext;
	let glSystem = GLSystem.getInstance();

	onMount(() => {
		bitmapContext = outputCanvasElement.getContext('bitmaprenderer')!;
		glSystem.backgroundOutputCanvasContext = bitmapContext;
	});

	onDestroy(() => {
		// Unregister the context if we are still using it.
		if (glSystem.backgroundOutputCanvasContext === bitmapContext) {
			glSystem.backgroundOutputCanvasContext = null;
		}
	});
</script>

<div
	class={`pointer-events-none z-[-1] flex h-[100%] w-[100%] cursor-none ${
		$isBackgroundOutputCanvasEnabled ? '' : 'hidden'
	}`}
>
	<canvas bind:this={outputCanvasElement} height={800} width={800} class="w-full"></canvas>
</div>
