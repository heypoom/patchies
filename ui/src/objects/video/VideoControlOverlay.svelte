<script lang="ts">
  import { Pause, Play } from '@lucide/svelte/icons';
  import {
    formatVideoOverlayTime,
    getRangePointerTime,
    VideoOverlayPointerFocusGate
  } from '$objects/video/video-control-overlay';

  let {
    visible,
    scrubbing,
    paused,
    currentTime,
    duration,
    progress,
    onTogglePause,
    onShowControls,
    onSeekStart,
    onSeekInput,
    onSeekEnd
  }: {
    visible: boolean;
    scrubbing: boolean;
    paused: boolean;
    currentTime: number;
    duration: number;
    progress: number;
    onTogglePause: () => void;
    onShowControls: () => void;
    onSeekStart: (time?: number) => void;
    onSeekInput: (time: number) => void;
    onSeekEnd: () => void;
  } = $props();

  const PauseIcon = $derived(paused ? Play : Pause);
  const currentTimeLabel = $derived(formatVideoOverlayTime(currentTime));
  const durationLabel = $derived(formatVideoOverlayTime(duration));
  const rangeValue = $derived(Math.min(currentTime, duration || currentTime));
  const pointerFocusGate = new VideoOverlayPointerFocusGate();

  function handleSeekInput(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const time = input.valueAsNumber;

    if (!Number.isFinite(time)) return;

    onSeekInput(time);
  }

  function handleSeekPointerDown(event: PointerEvent) {
    const input = event.currentTarget as HTMLInputElement;
    const rect = input.getBoundingClientRect();
    const time = getRangePointerTime({
      clientX: event.clientX,
      left: rect.left,
      width: rect.width,
      min: Number(input.min),
      max: Number(input.max)
    });

    pointerFocusGate.startPointerSeek();
    onSeekStart(time);
  }

  function handleSeekFocus() {
    if (pointerFocusGate.shouldStartSeekOnFocus()) {
      onSeekStart();
    }

    onShowControls();
  }

  function handleSeekEnd() {
    pointerFocusGate.endPointerSeek();
    onSeekEnd();
  }

  function handlePause() {
    onShowControls();
    onTogglePause();
  }
</script>

<div
  class="nodrag absolute bottom-2 left-1/2 z-10 w-[min(20rem,calc(100%_-_1rem))] -translate-x-1/2 transition-all duration-200 {visible ||
  scrubbing
    ? 'translate-y-0 opacity-100'
    : 'pointer-events-none translate-y-1 opacity-0'}"
>
  <div
    class="flex items-center gap-1.5 rounded-lg bg-zinc-950/60 px-1.5 py-1 text-white shadow-md backdrop-blur-xs"
  >
    <button
      type="button"
      aria-label={paused ? 'Play video' : 'Pause video'}
      class="ml-3 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-zinc-200 text-zinc-700 transition hover:bg-white focus-visible:ring-1 focus-visible:ring-blue-300 focus-visible:outline-none"
      onclick={handlePause}
      onfocus={onShowControls}
    >
      <PauseIcon class="h-3 w-3" />
    </button>

    <div class="w-8 shrink-0 text-right font-mono text-[7px] leading-none text-zinc-300">
      {currentTimeLabel}
    </div>

    <input
      type="range"
      min="0"
      max={Math.max(duration, 0)}
      step="0.001"
      value={rangeValue}
      aria-label="Seek video"
      class="video-overlay-seek h-1 min-w-0 flex-1 cursor-pointer"
      style={`--video-overlay-progress: ${progress}%`}
      disabled={duration <= 0}
      onpointerdown={handleSeekPointerDown}
      onpointerup={handleSeekEnd}
      onpointercancel={handleSeekEnd}
      onfocus={handleSeekFocus}
      onblur={handleSeekEnd}
      oninput={handleSeekInput}
      onchange={handleSeekEnd}
    />

    <div class="w-8 shrink-0 font-mono text-[7px] leading-none text-zinc-300">
      {durationLabel}
    </div>
  </div>
</div>

<style>
  .video-overlay-seek {
    appearance: none;
    border-radius: 9999px;
    background: linear-gradient(
      to right,
      rgb(255 255 255 / 0.8) 0%,
      rgb(255 255 255 / 0.8) var(--video-overlay-progress),
      rgb(255 255 255 / 0.3) var(--video-overlay-progress),
      rgb(255 255 255 / 0.3) 100%
    );
  }

  .video-overlay-seek:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .video-overlay-seek::-webkit-slider-runnable-track {
    height: 2px;
    border-radius: 9999px;
    background: transparent;
  }

  .video-overlay-seek::-webkit-slider-thumb {
    appearance: none;
    width: 8px;
    height: 8px;
    margin-top: -3px;
    border-radius: 9999px;
    background: white;
    box-shadow: 0 1px 5px rgb(0 0 0 / 0.35);
  }

  .video-overlay-seek::-moz-range-track {
    height: 2px;
    border-radius: 9999px;
    background: transparent;
  }

  .video-overlay-seek::-moz-range-progress {
    height: 2px;
    border-radius: 9999px;
    background: white;
  }

  .video-overlay-seek::-moz-range-thumb {
    width: 8px;
    height: 8px;
    border: 0;
    border-radius: 9999px;
    background: white;
    box-shadow: 0 1px 5px rgb(0 0 0 / 0.35);
  }
</style>
