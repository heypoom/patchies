<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { isBackgroundOutputCanvasEnabled } from '../../stores/canvas.store';
  import { GLSystem } from '$lib/canvas/GLSystem';

  let outputCanvasElement: HTMLCanvasElement;
  let bitmapContext: ImageBitmapRenderingContext;
  let glSystem = GLSystem.getInstance();

  onMount(() => {
    const [outputWidth, outputHeight] = glSystem.outputSize;
    outputCanvasElement.width = outputWidth;
    outputCanvasElement.height = outputHeight;

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
    $isBackgroundOutputCanvasEnabled ? 'bg-[#080809]' : 'hidden'
  }`}
  style="contain: strict; isolation: isolate;"
>
  <canvas
    bind:this={outputCanvasElement}
    class="h-screen w-full object-cover"
    style="will-change: contents;"
  ></canvas>
</div>
