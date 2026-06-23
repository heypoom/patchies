<script lang="ts">
  import SettingsSlider from '$lib/components/SettingsSlider.svelte';

  type TapMode = 'wave' | 'xy';

  let {
    mode,
    bufferSize,
    fps,
    zeroCrossing,
    bufferSizeTracker,
    fpsTracker,
    onModeChange,
    onBufferSizeChange,
    onFpsChange,
    onZeroCrossingChange
  }: {
    mode: TapMode;
    bufferSize: number;
    fps: number;
    zeroCrossing: boolean;
    bufferSizeTracker: { onFocus: () => void; onBlur: () => void };
    fpsTracker: { onFocus: () => void; onBlur: () => void };
    onModeChange: (value: TapMode) => void;
    onBufferSizeChange: (value: number) => void;
    onFpsChange: (value: number) => void;
    onZeroCrossingChange: (value: boolean) => void;
  } = $props();
</script>

<div class="space-y-4">
  <div>
    <div class="mb-1 flex items-center justify-between">
      <span class="text-xs font-medium text-zinc-300">Samples</span>
      <span class="text-xs text-zinc-500">{bufferSize}</span>
    </div>

    <SettingsSlider
      min={64}
      max={2048}
      value={bufferSize}
      onchange={onBufferSizeChange}
      onpointerdown={bufferSizeTracker.onFocus}
      onpointerup={bufferSizeTracker.onBlur}
    />
  </div>

  <div class="flex items-center justify-between">
    <span class="text-xs font-medium text-zinc-300">Zero Crossing</span>
    <button
      class={[
        'h-5 w-9 cursor-pointer rounded-full transition-colors',
        zeroCrossing ? 'bg-green-600' : 'bg-zinc-700'
      ]}
      onclick={() => onZeroCrossingChange(!zeroCrossing)}
      aria-label="Toggle zero-crossing detection"
      aria-pressed={zeroCrossing}
    >
      <div
        class={[
          'h-4 w-4 rounded-full bg-white transition-transform',
          zeroCrossing ? 'translate-x-4.5' : 'translate-x-0.5'
        ]}
      ></div>
    </button>
  </div>

  <div>
    <span class="mb-1 block text-xs font-medium text-zinc-300">Mode</span>
    <div class="flex gap-1">
      {#each ['wave', 'xy'] as modeOption (modeOption)}
        <button
          class={[
            'flex-1 cursor-pointer rounded px-2 py-1 text-xs transition-colors',
            mode === modeOption
              ? 'bg-green-600 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          ]}
          onclick={() => onModeChange(modeOption as TapMode)}
        >
          {modeOption}
        </button>
      {/each}
    </div>
  </div>

  <div>
    <div class="mb-1 flex items-center justify-between">
      <span class="text-xs font-medium text-zinc-300">FPS Limit</span>
      <span class="text-xs text-zinc-500">{fps === 0 ? 'max' : `${fps} fps`}</span>
    </div>
    <SettingsSlider
      min={0}
      max={120}
      value={fps}
      onchange={onFpsChange}
      onpointerdown={fpsTracker.onFocus}
      onpointerup={fpsTracker.onBlur}
    />
  </div>
</div>
