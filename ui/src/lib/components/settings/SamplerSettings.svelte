<script lang="ts">
  import { RefreshCcw, X } from '@lucide/svelte/icons';
  import SettingsSlider from '$lib/components/SettingsSlider.svelte';
  import type { NodeDataTracker, ContinuousTracker } from '$lib/history';

  type Props = {
    loopStart: number;
    loopEnd: number;
    recordingDuration: number;
    loopEnabled: boolean;
    playbackRate: number;
    detune: number;
    onLoopStartChange: (value: number) => void;
    onLoopEndChange: (value: number) => void;
    onPlaybackRateChange: (value: number) => void;
    onDetuneChange: (value: number) => void;
    onToggleLoop: () => void;
    onReset: () => void;
    onClose: () => void;
    tracker: NodeDataTracker;
    loopStartTracker: ContinuousTracker;
    loopEndTracker: ContinuousTracker;
    playbackRateTracker: ContinuousTracker;
    detuneTracker: ContinuousTracker;
  };

  let {
    loopStart,
    loopEnd,
    recordingDuration,
    loopEnabled,
    playbackRate,
    detune,
    onLoopStartChange,
    onLoopEndChange,
    onPlaybackRateChange,
    onDetuneChange,
    onToggleLoop,
    onReset,
    onClose,
    tracker,
    loopStartTracker,
    loopEndTracker,
    playbackRateTracker,
    detuneTracker
  }: Props = $props();
</script>

<div class="relative">
  <div class="absolute -top-7 left-0 flex w-full justify-end gap-1">
    <button onclick={onReset} class="rounded p-1 hover:bg-zinc-700" title="Reset all settings">
      <RefreshCcw class="h-4 w-4 text-zinc-300" />
    </button>

    <button onclick={onClose} class="rounded p-1 hover:bg-zinc-700">
      <X class="h-4 w-4 text-zinc-300" />
    </button>
  </div>

  <div class="nodrag w-64 rounded-lg border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
    <div class="space-y-4">
      <div>
        <div class="mb-2 text-xs font-medium text-zinc-300">Playback Settings</div>

        <!-- Start Point -->
        <div class="mb-3">
          <div class="mb-1 flex items-center justify-between">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="text-xs text-zinc-400">Start (s)</label>
            <span class="font-mono text-xs text-zinc-300">{loopStart.toFixed(2)}</span>
          </div>

          <SettingsSlider
            min={0}
            max={recordingDuration}
            step={0.01}
            value={loopStart}
            onchange={onLoopStartChange}
            onpointerdown={loopStartTracker.onFocus}
            onpointerup={loopStartTracker.onBlur}
          />
        </div>

        <!-- End Point -->
        <div class="mb-3">
          <div class="mb-1 flex items-center justify-between">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="text-xs text-zinc-400">End (s)</label>
            <span class="font-mono text-xs text-zinc-300">{loopEnd.toFixed(2)}</span>
          </div>

          <SettingsSlider
            min={0}
            max={recordingDuration}
            step={0.01}
            value={loopEnd}
            onchange={onLoopEndChange}
            onpointerdown={loopEndTracker.onFocus}
            onpointerup={loopEndTracker.onBlur}
          />
        </div>

        <!-- Loop Toggle -->
        <div class="mb-3 flex items-center justify-between border-t border-zinc-700 pt-3">
          <span class="text-xs text-zinc-400">Loop</span>

          <button
            onclick={() => {
              const oldValue = loopEnabled;
              onToggleLoop();
              tracker.commit('loop', oldValue, !oldValue);
            }}
            class="rounded px-2 py-1 text-xs {loopEnabled
              ? 'bg-orange-500 text-white'
              : 'bg-zinc-700 text-zinc-300'}"
          >
            {loopEnabled ? 'On' : 'Off'}
          </button>
        </div>

        <!-- Playback Rate -->
        <div class="mb-3 border-t border-zinc-700 pt-3">
          <div class="mb-1 flex items-center justify-between">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="text-xs text-zinc-400">Playback Rate</label>
            <span class="font-mono text-xs text-zinc-300">{playbackRate.toFixed(2)}</span>
          </div>

          <SettingsSlider
            min={0.25}
            max={4}
            step={0.01}
            value={playbackRate}
            onchange={onPlaybackRateChange}
            onpointerdown={playbackRateTracker.onFocus}
            onpointerup={playbackRateTracker.onBlur}
          />
        </div>

        <!-- Detune -->
        <div class="mb-3">
          <div class="mb-1 flex items-center justify-between">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="text-xs text-zinc-400">Detune (cents)</label>
            <span class="font-mono text-xs text-zinc-300">{detune.toFixed(0)}</span>
          </div>

          <SettingsSlider
            min={-1200}
            max={1200}
            value={detune}
            onchange={onDetuneChange}
            onpointerdown={detuneTracker.onFocus}
            onpointerup={detuneTracker.onBlur}
          />
        </div>
      </div>

      <!-- Sample Info -->
      <div class="border-t border-zinc-700 pt-3">
        <div class="text-xs text-zinc-500">
          Duration: {recordingDuration.toFixed(2)}s
        </div>
      </div>
    </div>
  </div>
</div>
