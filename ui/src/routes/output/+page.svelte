<script lang="ts">
  import { onMount } from 'svelte';
  import { SurfaceListeners } from '$lib/canvas/SurfaceListeners';
  import {
    highlightCodeOverlayValue,
    isMainToOutputMessage,
    syncCanvasSizeToBitmap,
    type CodeOverlayMirrorState,
    type OutputToMainMessage
  } from '$lib/canvas/secondary-output-ipc';

  let outputCanvas: HTMLCanvasElement;
  let surfaceCanvas: HTMLCanvasElement;
  let outputBitmapContext: ImageBitmapRenderingContext;
  let surfaceBitmapContext: ImageBitmapRenderingContext;
  let codeOverlayState = $state<CodeOverlayMirrorState | null>(null);
  let surfaceOverlayActive = $state(false);
  let surfaceListeners = new SurfaceListeners();
  let expectedOrigin: string | null = null;

  let codeOverlayBackground = $derived(
    codeOverlayState ? `rgba(9, 9, 11, ${codeOverlayState.transparency})` : 'transparent'
  );
  let codeOverlayFontSize = $derived(`${codeOverlayState?.fontSizePx ?? 28}px`);
  let highlightedCode = $derived(
    codeOverlayState
      ? highlightCodeOverlayValue(codeOverlayState.value, codeOverlayState.language)
      : ''
  );

  function announceReady() {
    if (!expectedOrigin) return;

    window.opener?.postMessage({ type: 'outputReady' }, expectedOrigin);
  }

  function resizeCanvases() {
    const width = window.visualViewport?.width ?? window.innerWidth;
    const height = window.visualViewport?.height ?? window.innerHeight;

    outputCanvas.width = width;
    outputCanvas.height = height;
    surfaceCanvas.width = width;
    surfaceCanvas.height = height;
  }

  function attachSurfaceInput() {
    surfaceListeners.attach(surfaceCanvas, {
      onPointer: (event) => {
        postToOpener({ type: 'outputSurfacePointer', event });
      },
      onWheel: (event) => {
        postToOpener({ type: 'outputSurfaceWheel', event });
      },
      onTouch: (touches) => {
        postToOpener({ type: 'outputSurfaceTouch', touches });
      },
      onLeave: () => {
        postToOpener({ type: 'outputSurfaceLeave' });
      },
      code: '',
      nodeId: 'secondary-output-surface',
      customConsole: {} as never,
      wrapperOffset: 0
    });
  }

  function detachSurfaceInput() {
    surfaceListeners.detach();
  }

  function postToOpener(message: OutputToMainMessage) {
    if (!expectedOrigin) return;

    window.opener?.postMessage(message, expectedOrigin);
  }

  onMount(() => {
    expectedOrigin = getExpectedOrigin();

    resizeCanvases();

    outputBitmapContext = outputCanvas.getContext('bitmaprenderer')!;
    surfaceBitmapContext = surfaceCanvas.getContext('bitmaprenderer')!;

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== expectedOrigin) return;
      if (event.source !== window.opener) return;

      if (!isMainToOutputMessage(event.data)) return;

      if (event.data.type === 'renderOutput') {
        syncCanvasSizeToBitmap(outputCanvas, event.data.bitmap);
        outputBitmapContext.transferFromImageBitmap(event.data.bitmap);
      } else if (event.data.type === 'codeOverlayState') {
        codeOverlayState = event.data.state;
      } else if (event.data.type === 'surfaceOverlayState') {
        surfaceOverlayActive = event.data.state?.active ?? false;

        if (surfaceOverlayActive) {
          attachSurfaceInput();
        } else {
          detachSurfaceInput();
        }
      } else if (event.data.type === 'surfaceOverlayFrame') {
        syncCanvasSizeToBitmap(surfaceCanvas, event.data.bitmap);
        surfaceBitmapContext.transferFromImageBitmap(event.data.bitmap);
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('resize', resizeCanvases);

    // Announce to opener so it can re-capture the window reference after reloads
    announceReady();

    // Listen for ping from main page (handles main page reload)
    const channel = new BroadcastChannel('patchies-ipc');

    channel.addEventListener('message', (event) => {
      if (event.data.type === 'ping') {
        announceReady();
      }
    });

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('resize', resizeCanvases);

      detachSurfaceInput();
      channel.close();
    };
  });

  function getExpectedOrigin() {
    try {
      const referrerOrigin = new URL(document.referrer).origin;

      if (referrerOrigin === window.location.origin) {
        return referrerOrigin;
      }
    } catch {
      // Fall back to the app origin when the output page has no referrer.
    }

    return window.location.origin;
  }
</script>

<div class="secondary-output-root">
  <canvas id="output" class="output-layer" bind:this={outputCanvas}></canvas>
  <canvas
    id="surface-output"
    class="output-layer surface-layer"
    class:active={surfaceOverlayActive}
    bind:this={surfaceCanvas}
  ></canvas>

  {#if codeOverlayState}
    <div
      class="detached-code-editor-overlay code-overlay-mirror"
      style:background-color={codeOverlayBackground}
      style:font-size={codeOverlayFontSize}
      aria-label={codeOverlayState.title ?? 'Code overlay'}
    >
      <pre><code class="hljs">{@html highlightedCode}</code></pre>
    </div>
  {/if}
</div>

<style>
  :global(html),
  :global(body) {
    margin: 0;
    overflow: hidden;
    background: #000;
  }

  .secondary-output-root {
    position: fixed;
    inset: 0;
    min-height: 100vh;
    overflow: hidden;
    background: #000;
  }

  .output-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    min-height: 100vh;
    object-fit: cover;
  }

  .surface-layer {
    display: none;
    pointer-events: none;
  }

  .surface-layer.active {
    display: block;
    pointer-events: auto;
  }

  .code-overlay-mirror {
    position: fixed;
    inset: 0;
    z-index: 60;
    pointer-events: none;
    color: rgb(212 212 216);
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
      monospace;
    line-height: 1.55;
  }

  .code-overlay-mirror pre {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    margin: 0;
    overflow: auto;
    padding: 56px;
    white-space: pre;
  }

  .code-overlay-mirror code {
    display: block;
  }

  .code-overlay-mirror :global(.hljs-keyword),
  .code-overlay-mirror :global(.hljs-built_in),
  .code-overlay-mirror :global(.hljs-type),
  .code-overlay-mirror :global(.hljs-literal) {
    color: #c792ea;
  }

  .code-overlay-mirror :global(.hljs-string),
  .code-overlay-mirror :global(.hljs-regexp),
  .code-overlay-mirror :global(.hljs-symbol) {
    color: #c3e88d;
  }

  .code-overlay-mirror :global(.hljs-number),
  .code-overlay-mirror :global(.hljs-attr),
  .code-overlay-mirror :global(.hljs-variable),
  .code-overlay-mirror :global(.hljs-template-variable) {
    color: #f78c6c;
  }

  .code-overlay-mirror :global(.hljs-title),
  .code-overlay-mirror :global(.hljs-name),
  .code-overlay-mirror :global(.hljs-selector-id),
  .code-overlay-mirror :global(.hljs-selector-class) {
    color: #82aaff;
  }

  .code-overlay-mirror :global(.hljs-comment),
  .code-overlay-mirror :global(.hljs-quote) {
    color: #697098;
    font-style: italic;
  }

  .code-overlay-mirror :global(.hljs-meta),
  .code-overlay-mirror :global(.hljs-tag),
  .code-overlay-mirror :global(.hljs-deletion),
  .code-overlay-mirror :global(.hljs-addition) {
    color: #89ddff;
  }
</style>
