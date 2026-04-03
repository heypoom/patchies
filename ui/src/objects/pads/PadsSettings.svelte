<script lang="ts">
  import { X } from '@lucide/svelte/icons';
  import { useNodeDataTracker } from '$lib/history';
  import SettingsSlider from '$lib/components/SettingsSlider.svelte';
  import type { NoteOffMode, PadCount } from './constants';

  type Props = {
    nodeId: string;
    padCount: PadCount;
    maxVoices: number;
    noteOffMode: NoteOffMode;
    showGmLabels: boolean;
    showWaveform: boolean;
    showPadNumbers: boolean;
    onPadCountChange: (value: PadCount) => void;
    onMaxVoicesChange: (value: number) => void;
    onNoteOffModeChange: (value: NoteOffMode) => void;
    onShowGmLabelsChange: (value: boolean) => void;
    onShowWaveformChange: (value: boolean) => void;
    onShowPadNumbersChange: (value: boolean) => void;
    onClose: () => void;
  };

  let {
    nodeId,
    padCount,
    maxVoices,
    noteOffMode,
    showGmLabels,
    showWaveform,
    showPadNumbers,
    onPadCountChange,
    onMaxVoicesChange,
    onNoteOffModeChange,
    onShowGmLabelsChange,
    onShowWaveformChange,
    onShowPadNumbersChange,
    onClose
  }: Props = $props();

  const tracker = useNodeDataTracker(nodeId);
</script>

<div class="relative">
  <div class="absolute -top-7 right-0 flex justify-end">
    <button onclick={onClose} class="cursor-pointer rounded p-1 hover:bg-zinc-700">
      <X class="h-4 w-4 text-zinc-300" />
    </button>
  </div>

  <div class="nodrag w-52 rounded-lg border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
    <div class="space-y-4">
      <!-- Pad Count -->
      <div>
        <div class="mb-2 text-xs font-medium text-zinc-300">Pad Count</div>
        <div class="flex gap-1">
          {#each [8, 16] as count (count)}
            <button
              class={[
                'flex-1 cursor-pointer rounded px-2 py-1 text-xs transition-colors',
                padCount === count
                  ? 'bg-green-500 text-white'
                  : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
              ]}
              onclick={() => {
                const old = padCount;
                onPadCountChange(count as PadCount);
                tracker.commit('padCount', old, count);
              }}
            >
              {count}
            </button>
          {/each}
        </div>
      </div>

      <!-- Max Voices -->
      <div class="border-t border-zinc-700 pt-3">
        <div class="mb-2 flex items-center justify-between">
          <div class="text-xs font-medium text-zinc-300">Max Voices / Pad</div>
          <span class="font-mono text-xs text-zinc-300">{maxVoices}</span>
        </div>

        <SettingsSlider
          min={1}
          max={16}
          value={maxVoices}
          onchange={onMaxVoicesChange}
          onpointerdown={tracker.track('maxVoices', () => maxVoices).onFocus}
          onpointerup={tracker.track('maxVoices', () => maxVoices).onBlur}
        />
      </div>

      <!-- NoteOff Mode -->
      <div class="border-t border-zinc-700 pt-3">
        <div class="mb-2 text-xs font-medium text-zinc-300">Note Off Behavior</div>

        <div class="flex gap-1">
          {#each [['ignore', 'One-shot'], ['stop', 'Gated']] as [value, label] (value)}
            <button
              class={[
                'flex-1 cursor-pointer rounded px-2 py-1 text-xs transition-colors',
                noteOffMode === value
                  ? 'bg-green-500 text-white'
                  : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
              ]}
              onclick={() => {
                const old = noteOffMode;

                onNoteOffModeChange(value as NoteOffMode);
                tracker.commit('noteOffMode', old, value);
              }}
            >
              {label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Display -->
      <div class="space-y-2 border-t border-zinc-700 pt-3">
        <label class="flex cursor-pointer items-center justify-between">
          <span class="text-xs font-medium text-zinc-300">Pad Numbers</span>

          <input
            type="checkbox"
            checked={showPadNumbers}
            onchange={() => {
              const old = showPadNumbers;

              onShowPadNumbersChange(!showPadNumbers);
              tracker.commit('showPadNumbers', old, !old);
            }}
            class="h-3 w-3 cursor-pointer"
          />
        </label>

        <label class="flex cursor-pointer items-center justify-between">
          <span class="text-xs font-medium text-zinc-300">GM Labels</span>

          <input
            type="checkbox"
            checked={showGmLabels}
            onchange={() => {
              const old = showGmLabels;

              onShowGmLabelsChange(!showGmLabels);
              tracker.commit('showGmLabels', old, !old);
            }}
            class="h-3 w-3 cursor-pointer"
          />
        </label>

        <label class="flex cursor-pointer items-center justify-between">
          <span class="text-xs font-medium text-zinc-300">Waveform</span>

          <input
            type="checkbox"
            checked={showWaveform}
            onchange={() => {
              const old = showWaveform;

              onShowWaveformChange(!showWaveform);
              tracker.commit('showWaveform', old, !old);
            }}
            class="h-3 w-3 cursor-pointer"
          />
        </label>
      </div>
    </div>
  </div>
</div>
