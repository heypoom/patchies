<script lang="ts">
  import { onMount } from 'svelte';

  let canvas: HTMLCanvasElement;
  let bitmapRendererContext: ImageBitmapRenderingContext;

  onMount(() => {
    canvas.width = window.visualViewport?.width ?? window.innerWidth;
    canvas.height = window.visualViewport?.height ?? window.innerHeight;
    canvas.style.width = `100%`;
    canvas.style.height = `100%`;
    canvas.style.minHeight = '100vh';
    canvas.style.objectFit = 'cover';

    bitmapRendererContext = canvas.getContext('bitmaprenderer')!;

    window.addEventListener('message', (event) => {
      if (event.data.type === 'renderOutput') {
        bitmapRendererContext.transferFromImageBitmap(event.data.bitmap);
      }
    });
  });
</script>

<canvas id="output" bind:this={canvas}></canvas>
