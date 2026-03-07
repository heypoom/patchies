<script lang="ts">
  import {
    setupDprCanvas,
    drawWaveform,
    drawLoopOverlay,
    drawPlaybackHead
  } from '$lib/canvas/waveform-renderer';

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

  // Offscreen cache for the static waveform (re-created when buffer changes)
  let waveformCache: HTMLCanvasElement | null = null;
  let lastDrawnBuffer: AudioBuffer | null = null;

  // For real-time recording visualization
  let recordingHistory: number[] = [];
  const MAX_HISTORY_SAMPLES = 2048;

  // --- Canvas setup ---

  $effect(() => {
    void width;
    void height;
    if (canvasRef) {
      setupDprCanvas(canvasRef, width, height);
      // Invalidate cache — physical dimensions may have changed
      waveformCache = null;
      lastDrawnBuffer = null;
    }
  });

  // --- Static waveform (AudioBuffer) ---

  function buildCache(buffer: AudioBuffer) {
    if (!canvasRef) return;
    const cache = document.createElement('canvas');
    cache.width = canvasRef.width;
    cache.height = canvasRef.height;
    drawWaveform(cache, buffer.getChannelData(0));
    waveformCache = cache;
    lastDrawnBuffer = buffer;
  }

  function drawStatic() {
    if (!canvasRef || !waveformCache || !audioBuffer) return;
    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(waveformCache, 0, 0);

    if (showLoopPoints && loopEnd > loopStart) {
      drawLoopOverlay(canvasRef, audioBuffer.duration, loopStart, loopEnd);
    }
    if (playbackProgress > 0) {
      drawPlaybackHead(canvasRef, audioBuffer.duration, playbackProgress);
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

  // --- Main effect: react to audioBuffer / analyser changes ---

  $effect(() => {
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
      if (audioBuffer !== lastDrawnBuffer) buildCache(audioBuffer);
      drawStatic();
    } else {
      waveformCache = null;
      lastDrawnBuffer = null;
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
    if (waveformCache && audioBuffer && !analyser) drawStatic();
  });
</script>

<canvas bind:this={canvasRef} class="rounded {className}"></canvas>
