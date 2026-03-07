<script lang="ts">
  import {
    setupDprCanvas,
    drawWaveform,
    drawLoopOverlay,
    drawPlaybackHead,
    type ViewWindow
  } from '$lib/canvas/waveform-renderer';
  import { useWaveformZoom } from '$lib/canvas/use-waveform-zoom.svelte';

  let {
    audioBuffer,
    analyser,
    loopStart = 0,
    loopEnd = 0,
    playbackProgress = 0,
    showLoopPoints = false,
    class: className = '',
    width,
    height
  }: {
    audioBuffer?: AudioBuffer | null;
    analyser?: AnalyserNode | null;
    loopStart?: number;
    loopEnd?: number;
    playbackProgress?: number;
    showLoopPoints?: boolean;
    class?: string;
    width: number;
    height: number;
  } = $props();

  let canvasRef = $state<HTMLCanvasElement>();
  let animationFrameId: number | null = null;

  // Offscreen cache for the static waveform — keyed to buffer + view
  let waveformCache: HTMLCanvasElement | null = null;
  let lastDrawnBuffer: AudioBuffer | null = null;
  let lastDrawnView: ViewWindow | null = null;

  // For real-time recording visualization
  let recordingHistory: number[] = [];
  const MAX_HISTORY_SAMPLES = 2048;

  const zoom = useWaveformZoom();

  // --- Canvas setup ---

  $effect(() => {
    void width;
    void height;
    if (canvasRef) {
      setupDprCanvas(canvasRef, width, height);
      waveformCache = null;
      lastDrawnBuffer = null;
      lastDrawnView = null;
    }
  });

  // --- Static waveform (AudioBuffer) ---

  function viewChanged(v: ViewWindow): boolean {
    return !lastDrawnView || lastDrawnView.start !== v.start || lastDrawnView.end !== v.end;
  }

  function buildCache(buffer: AudioBuffer, view: ViewWindow) {
    if (!canvasRef) return;
    const cache = document.createElement('canvas');
    cache.width = canvasRef.width;
    cache.height = canvasRef.height;
    drawWaveform(cache, buffer.getChannelData(0), view);
    waveformCache = cache;
    lastDrawnBuffer = buffer;
    lastDrawnView = { start: view.start, end: view.end };
  }

  function drawStatic(view: ViewWindow) {
    if (!canvasRef || !audioBuffer) return;

    if (audioBuffer !== lastDrawnBuffer || viewChanged(view)) {
      buildCache(audioBuffer, view);
    }

    const ctx = canvasRef.getContext('2d');
    if (!ctx || !waveformCache) return;

    ctx.drawImage(waveformCache, 0, 0);

    if (showLoopPoints && loopEnd > loopStart) {
      drawLoopOverlay(canvasRef, audioBuffer.duration, loopStart, loopEnd, view);
    }
    if (playbackProgress > 0) {
      drawPlaybackHead(canvasRef, audioBuffer.duration, playbackProgress, view);
    }
  }

  // --- Real-time waveform (AnalyserNode while recording) ---

  function startRealtimeDrawing() {
    if (!canvasRef || !analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const downsampleFactor = Math.ceil(bufferLength / 256);

    const draw = () => {
      if (!analyser || !canvasRef) return;

      analyser.getByteTimeDomainData(dataArray);

      for (let i = 0; i < bufferLength; i += downsampleFactor) {
        recordingHistory.push(dataArray[i] / 128.0 - 1.0);
      }
      if (recordingHistory.length > MAX_HISTORY_SAMPLES) {
        recordingHistory = recordingHistory.slice(-MAX_HISTORY_SAMPLES);
      }

      drawWaveform(canvasRef, Float32Array.from(recordingHistory));
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();
  }

  function stopAnimation() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  // --- Main effect: react to audioBuffer / analyser / zoom changes ---

  $effect(() => {
    const view = zoom.view;
    if (!canvasRef) return;

    stopAnimation();

    if (analyser) {
      waveformCache = null;
      lastDrawnBuffer = null;
      recordingHistory = [];
      startRealtimeDrawing();
      return () => stopAnimation();
    }

    if (audioBuffer) {
      recordingHistory = [];
      drawStatic(view);
    } else {
      waveformCache = null;
      lastDrawnBuffer = null;
      lastDrawnView = null;
      recordingHistory = [];
      const ctx = canvasRef.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, canvasRef.width, canvasRef.height);
      }
    }
  });

  // --- Overlay-only effect (loop points / playback head) ---

  $effect(() => {
    void loopStart;
    void loopEnd;
    void showLoopPoints;
    void playbackProgress;
    if (waveformCache && audioBuffer && !analyser) drawStatic(zoom.view);
  });
</script>

<canvas bind:this={canvasRef} class="nowheel rounded {className}" onwheel={zoom.handleWheel}
></canvas>
