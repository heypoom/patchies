<script lang="ts">
  import { onMount } from 'svelte';

  let canvas: HTMLCanvasElement;
  let bitmapRendererContext: ImageBitmapRenderingContext;

  function announceReady() {
    window.opener?.postMessage({ type: 'outputReady' }, '*');
  }

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

    // Announce to opener so it can re-capture the window reference after reloads
    announceReady();

    // Listen for ping from main page (handles main page reload)
    const channel = new BroadcastChannel('patchies-ipc');
    channel.addEventListener('message', (event) => {
      if (event.data.type === 'ping') announceReady();
    });

    return () => channel.close();
  });
</script>

<canvas id="output" bind:this={canvas}></canvas>
