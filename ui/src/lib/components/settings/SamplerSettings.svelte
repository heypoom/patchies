<script lang="ts">
  import { RefreshCcw, X } from '@lucide/svelte/icons';
  import SettingsSlider from '$lib/components/SettingsSlider.svelte';
  import type { NodeDataTracker, ContinuousTracker } from '$lib/history';

  type NoteOffMode = 'one-shot' | 'held';

  type Props = {
    loopStart: number;
    loopEnd: number;
    recordingDuration: number;
    loopEnabled: boolean;
    gain: number;
    playbackRate: number;
    detune: number;
    noteOffMode: NoteOffMode;
    onLoopStartChange: (value: number) => void;
    onLoopEndChange: (value: number) => void;
    onGainChange: (value: number) => void;
    onPlaybackRateChange: (value: number) => void;
    onDetuneChange: (value: number) => void;
    onNoteOffModeChange: (value: NoteOffMode) => void;
    onToggleLoop: () => void;
    onReset: () => void;
    onClose: () => void;
    tracker: NodeDataTracker;
    loopStartTracker: ContinuousTracker;
    loopEndTracker: ContinuousTracker;
    gainTracker: ContinuousTracker;
    playbackRateTracker: ContinuousTracker;
    detuneTracker: ContinuousTracker;
  };

  let {
    loopStart,
    loopEnd,
    recordingDuration,
    loopEnabled,
    gain,
    playbackRate,
    detune,
    noteOffMode,
    onLoopStartChange,
    onLoopEndChange,
    onGainChange,
    onPlaybackRateChange,
    onDetuneChange,
    onNoteOffModeChange,
    onToggleLoop,
    onReset,
    onClose,
    tracker,
    loopStartTracker,
    loopEndTracker,
    gainTracker,
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
        <div class="mb-2 text-xs font-medium text-zinc-300">Sample Range</div>

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

        <!-- Playback Rate -->
        <div class="mb-3">
          <div class="mb-2 text-xs font-medium text-zinc-300">Playback</div>

          <div class="mb-3">
            <div class="mb-1 flex items-center justify-between">
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <label class="text-xs text-zinc-400">Gain</label>
              <span class="font-mono text-xs text-zinc-300">{gain.toFixed(2)}</span>
            </div>

            <SettingsSlider
              min={0}
              max={2}
              step={0.01}
              value={gain}
              onchange={onGainChange}
              onpointerdown={gainTracker.onFocus}
              onpointerup={gainTracker.onBlur}
            />
          </div>

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

        <!-- Behavior -->
        <div class="mb-3">
          <div class="mb-2 text-xs font-medium text-zinc-300">Behavior</div>

          <div class="flex flex-col gap-1">
            <button
              class="flex cursor-pointer items-center gap-1.5 transition-colors"
              onclick={() => {
                const oldValue = loopEnabled;
                onToggleLoop();
                tracker.commit('loop', oldValue, !oldValue);
              }}
            >
              <div
                class="h-3 w-3 shrink-0 rounded-sm border transition-colors"
                class:border-zinc-500={loopEnabled}
                class:bg-zinc-500={loopEnabled}
                class:border-zinc-600={!loopEnabled}
              ></div>
              <span
                class="text-xs"
                class:text-zinc-400={loopEnabled}
                class:text-zinc-500={!loopEnabled}
              >
                Loop
              </span>
            </button>

            <button
              type="button"
              class="flex cursor-pointer items-center gap-1.5 transition-colors"
              onclick={() => onNoteOffModeChange(noteOffMode === 'held' ? 'one-shot' : 'held')}
            >
              <div
                class="h-3 w-3 shrink-0 rounded-sm border transition-colors"
                class:border-zinc-500={noteOffMode === 'held'}
                class:bg-zinc-500={noteOffMode === 'held'}
                class:border-zinc-600={noteOffMode !== 'held'}
              ></div>
              <span
                class="text-xs"
                class:text-zinc-400={noteOffMode === 'held'}
                class:text-zinc-500={noteOffMode !== 'held'}
              >
                Held notes
              </span>
            </button>
          </div>
        </div>
      </div>

      <!-- Sample Info -->
      <div>
        <div class="text-xs text-zinc-500">
          Duration: {recordingDuration.toFixed(2)}s
        </div>
      </div>
    </div>
  </div>
</div>
