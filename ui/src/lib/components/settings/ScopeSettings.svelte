<script lang="ts">
  import { ChevronRight } from '@lucide/svelte/icons';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import SettingsSlider from '$lib/components/SettingsSlider.svelte';

  type PlotType = 'line' | 'point' | 'bezier';
  type ScopeMode = 'waveform' | 'xy';

  let {
    mode,
    bufferSize,
    xScale,
    yScale,
    fps,
    plotType,
    decay,
    unipolar,
    advancedOpen = $bindable(false),
    bufferSizeTracker,
    xScaleTracker,
    yScaleTracker,
    fpsTracker,
    decayTracker,
    onModeChange,
    onBufferSizeChange,
    onXScaleChange,
    onYScaleChange,
    onFpsChange,
    onPlotTypeChange,
    onUnipolarChange,
    onDecayChange
  }: {
    mode: ScopeMode;
    bufferSize: number;
    xScale: number;
    yScale: number;
    fps: number;
    plotType: PlotType;
    decay: number;
    unipolar: boolean;
    advancedOpen?: boolean;
    bufferSizeTracker: { onFocus: () => void; onBlur: () => void };
    xScaleTracker: { onFocus: () => void; onBlur: () => void };
    yScaleTracker: { onFocus: () => void; onBlur: () => void };
    fpsTracker: { onFocus: () => void; onBlur: () => void };
    decayTracker: { onFocus: () => void; onBlur: () => void };
    onModeChange: (value: ScopeMode) => void;
    onBufferSizeChange: (value: number) => void;
    onXScaleChange: (value: number) => void;
    onYScaleChange: (value: number) => void;
    onFpsChange: (value: number) => void;
    onPlotTypeChange: (value: PlotType) => void;
    onUnipolarChange: (value: boolean) => void;
    onDecayChange: (value: number) => void;
  } = $props();
</script>

<div class="space-y-4">
  <!-- Buffer Size -->
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

  <!-- X Scale -->
  <div>
    <div class="mb-1 flex items-center justify-between">
      <span class="text-xs font-medium text-zinc-300">X Scale</span>
      <span class="text-xs text-zinc-500">{xScale.toFixed(1)}x</span>
    </div>
    <SettingsSlider
      min={mode === 'xy' ? 0.1 : 0.5}
      max={mode === 'xy' ? 10 : 8}
      step={0.1}
      value={xScale}
      onchange={onXScaleChange}
      onpointerdown={xScaleTracker.onFocus}
      onpointerup={xScaleTracker.onBlur}
    />
  </div>

  <!-- Y Scale -->
  <div>
    <div class="mb-1 flex items-center justify-between">
      <span class="text-xs font-medium text-zinc-300">Y Scale</span>
      <span class="text-xs text-zinc-500">{yScale.toFixed(1)}x</span>
    </div>
    <SettingsSlider
      min={0.1}
      max={10}
      step={0.1}
      value={yScale}
      onchange={onYScaleChange}
      onpointerdown={yScaleTracker.onFocus}
      onpointerup={yScaleTracker.onBlur}
    />
  </div>

  <!-- Advanced accordion -->
  <Collapsible.Root bind:open={advancedOpen}>
    <Collapsible.Trigger
      class="flex w-full cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
    >
      <ChevronRight class={['h-3 w-3 transition-transform', advancedOpen && 'rotate-90']} />
      <span>Advanced</span>
    </Collapsible.Trigger>

    <Collapsible.Content class="mt-2 space-y-4">
      <!-- Mode -->
      <div>
        <span class="mb-1 block text-xs font-medium text-zinc-300">Mode</span>
        <div class="flex gap-1">
          {#each ['waveform', 'xy'] as modeOption (modeOption)}
            <button
              class={[
                'flex-1 cursor-pointer rounded px-2 py-1 text-xs transition-colors',
                mode === modeOption
                  ? 'bg-green-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              ]}
              onclick={() => onModeChange(modeOption as ScopeMode)}
            >
              {modeOption}
            </button>
          {/each}
        </div>
      </div>

      <!-- Plot Type -->
      <div>
        <span class="mb-1 block text-xs font-medium text-zinc-300">Plot</span>
        <div class="flex gap-1">
          {#each ['line', 'point', 'bezier'] as type (type)}
            <button
              class={[
                'flex-1 cursor-pointer rounded px-2 py-1 text-xs transition-colors',
                plotType === type
                  ? 'bg-green-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              ]}
              onclick={() => onPlotTypeChange(type as PlotType)}
            >
              {type}
            </button>
          {/each}
        </div>
      </div>

      <!-- Unipolar -->
      <div>
        <label class="flex cursor-pointer items-center justify-between">
          <span class="text-xs font-medium text-zinc-300">Unipolar</span>
          <button
            class={[
              'h-5 w-9 cursor-pointer rounded-full transition-colors',
              unipolar ? 'bg-green-600' : 'bg-zinc-700'
            ]}
            onclick={() => onUnipolarChange(!unipolar)}
          >
            <div
              class={[
                'h-4 w-4 rounded-full bg-white transition-transform',
                unipolar ? 'translate-x-4.5' : 'translate-x-0.5'
              ]}
            ></div>
          </button>
        </label>
      </div>

      <!-- Decay -->
      <div>
        <div class="mb-1 flex items-center justify-between">
          <span class="text-xs font-medium text-zinc-300">Decay</span>
          <span class="text-xs text-zinc-500"
            >{decay >= 1 ? 'off' : `${(decay * 100).toFixed(0)}%`}</span
          >
        </div>
        <SettingsSlider
          min={0.01}
          max={1}
          step={0.01}
          value={decay}
          onchange={onDecayChange}
          onpointerdown={decayTracker.onFocus}
          onpointerup={decayTracker.onBlur}
        />
      </div>

      <!-- Refresh Rate -->
      <div>
        <div class="mb-1 flex items-center justify-between">
          <span class="text-xs font-medium text-zinc-300">Refresh</span>
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
    </Collapsible.Content>
  </Collapsible.Root>
</div>
