<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { isBackgroundOutputCanvasEnabled } from '../../stores/canvas.store';
  import { GLSystem } from '$lib/canvas/GLSystem';

  let outputCanvasElement: HTMLCanvasElement;
  let bitmapContext: ImageBitmapRenderingContext;
  let glSystem = GLSystem.getInstance();

  function setOutputToWindowSize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    outputCanvasElement.width = width;
    outputCanvasElement.height = height;

    glSystem.setOutputSize(width, height);
  }

  onMount(() => {
    bitmapContext = outputCanvasElement.getContext('bitmaprenderer')!;

    glSystem.backgroundOutputCanvasContext = bitmapContext;
    setOutputToWindowSize();

    window.addEventListener('resize', setOutputToWindowSize);
  });

  onDestroy(() => {
    window.removeEventListener('resize', setOutputToWindowSize);

    // Unregister the context if we are still using it.
    if (glSystem.backgroundOutputCanvasContext === bitmapContext) {
      glSystem.backgroundOutputCanvasContext = null;
    }
  });
</script>

<div
  class={`pointer-events-none z-[-1] flex h-[100%] w-[100%] cursor-none ${
    $isBackgroundOutputCanvasEnabled ? 'bg-[#080809]' : 'hidden'
  }`}
  style="contain: strict; isolation: isolate;"
>
  <canvas bind:this={outputCanvasElement} class="h-screen w-full" style="will-change: contents;"
  ></canvas>
</div>
