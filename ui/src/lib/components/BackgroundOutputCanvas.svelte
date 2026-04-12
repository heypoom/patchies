<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { isBackgroundOutputCanvasEnabled } from '../../stores/canvas.store';
  import { GLSystem } from '$lib/canvas/GLSystem';

  let outputCanvasElement: HTMLCanvasElement;
  let bitmapContext: ImageBitmapRenderingContext;
  let glSystem = GLSystem.getInstance();
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;

  function setOutputToWindowSize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    outputCanvasElement.width = width;
    outputCanvasElement.height = height;

    if (resizeTimer !== null) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      glSystem.setBackgroundSize(width, height);
      resizeTimer = null;
    }, 150);
  }

  onMount(() => {
    bitmapContext = outputCanvasElement.getContext('bitmaprenderer')!;

    glSystem.backgroundOutputCanvasContext = bitmapContext;
    // Call directly (no debounce) on mount so initial size is set immediately.
    glSystem.setBackgroundSize(window.innerWidth, window.innerHeight);
    outputCanvasElement.width = window.innerWidth;
    outputCanvasElement.height = window.innerHeight;

    window.addEventListener('resize', setOutputToWindowSize);
  });

  onDestroy(() => {
    window.removeEventListener('resize', setOutputToWindowSize);
    if (resizeTimer !== null) clearTimeout(resizeTimer);

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
