<script lang="ts">
  import type { ContinuousTracker } from '$lib/history';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import SettingsSlider from '$lib/components/SettingsSlider.svelte';
  import { Plus, Trash2 } from '@lucide/svelte/icons';
  import type { TrackData } from '$lib/nodes/sequencer-constants';

  const STEP_COUNTS = [4, 8, 12, 16, 24, 32] as const;

  type OutletMode = 'multi' | 'single';

  const MULTI_OUTPUT_MODES = [
    {
      id: 'bang' as const,
      label: 'bang',
      tip: 'Sends {type:"bang"} — works with sampler~, trigger, etc.'
    },
    { id: 'value' as const, label: 'value', tip: 'Sends velocity value (0–1)' },
    {
      id: 'audio' as const,
      label: 'audio',
      tip: 'Sends {time, value} for Web Audio lookahead scheduling'
    }
  ];

  const SINGLE_OUTPUT_MODES = [
    { id: 'index' as const, label: 'index', tip: 'Sends track index (0–N) — connect to pads~' },
    { id: 'midi' as const, label: 'midi', tip: 'Sends {type:"noteOn", note, index, velocity}' },
    {
      id: 'audio' as const,
      label: 'audio',
      tip: 'Sends {type:"noteOn", note, index, velocity, time}'
    }
  ];

  let {
    steps,
    swing,
    outletMode,
    outputMode,
    clockMode,
    showVelocity,
    showInTimeline,
    tracks,
    swingTracker,
    onSetStepCount,
    onSetSwing,
    onSetOutletMode,
    onSetOutputMode,
    onSetClockMode,
    onSetShowVelocity,
    onSetShowInTimeline,
    onAddTrack,
    onRemoveTrack,
    onUpdateTrackName,
    onUpdateTrackColor
  }: {
    steps: number;
    swing: number;
    outletMode: OutletMode;
    outputMode: string;
    clockMode: 'auto' | 'manual';
    showVelocity: boolean;
    showInTimeline: boolean;
    tracks: TrackData[];
    swingTracker: ContinuousTracker;
    onSetStepCount: (n: number) => void;
    onSetSwing: (v: number) => void;
    onSetOutletMode: (v: OutletMode) => void;
    onSetOutputMode: (v: string) => void;
    onSetClockMode: (v: 'auto' | 'manual') => void;
    onSetShowVelocity: (v: boolean) => void;
    onSetShowInTimeline: (v: boolean) => void;
    onAddTrack: () => void;
    onRemoveTrack: (idx: number) => void;
    onUpdateTrackName: (idx: number, name: string) => void;
    onUpdateTrackColor: (idx: number, color: string) => void;
  } = $props();

  const activeOutputModes = $derived(
    outletMode === 'single' ? SINGLE_OUTPUT_MODES : MULTI_OUTPUT_MODES
  );
</script>

<div class="nodrag w-56 rounded-md border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
  <div class="flex flex-col gap-3">
    <!-- Steps -->
    <div>
      <label class="mb-2 block text-xs font-medium text-zinc-300">Steps</label>
      <div class="flex flex-wrap gap-1">
        {#each STEP_COUNTS as count}
          <button
            onclick={() => onSetStepCount(count)}
            class="cursor-pointer rounded px-2 py-1 text-xs transition-colors"
            class:bg-zinc-600={steps === count}
            class:text-white={steps === count}
            class:bg-zinc-800={steps !== count}
            class:text-zinc-300={steps !== count}
            class:hover:bg-zinc-700={steps !== count}
          >
            {count}
          </button>
        {/each}
      </div>
    </div>

    <!-- Output mode (dynamic based on outlet mode) -->
    <div class="py-1.5">
      <label class="mb-2 block text-xs font-medium text-zinc-300">Output</label>
      <div class="flex gap-1">
        {#each activeOutputModes as mode}
          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                onclick={() => onSetOutputMode(mode.id)}
                class="cursor-pointer rounded px-2 py-1 text-xs transition-colors"
                class:bg-zinc-600={outputMode === mode.id}
                class:text-white={outputMode === mode.id}
                class:bg-zinc-800={outputMode !== mode.id}
                class:text-zinc-300={outputMode !== mode.id}
                class:hover:bg-zinc-700={outputMode !== mode.id}
              >
                {mode.label}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content>{mode.tip}</Tooltip.Content>
          </Tooltip.Root>
        {/each}
      </div>

      <!-- Checkboxes -->
      <div class="mt-2 flex flex-col gap-1">
        <!-- Velocity Lane -->
        <button
          class="flex cursor-pointer items-center gap-1.5 transition-colors"
          onclick={() => onSetShowVelocity(!showVelocity)}
        >
          <div
            class="h-3 w-3 shrink-0 rounded-sm border transition-colors"
            class:border-zinc-500={showVelocity}
            class:bg-zinc-500={showVelocity}
            class:border-zinc-600={!showVelocity}
          ></div>
          <span
            class="text-xs"
            class:text-zinc-400={showVelocity}
            class:text-zinc-500={!showVelocity}
          >
            Velocity lane
          </span>
        </button>

        <!-- Single outlet -->
        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              class="flex cursor-pointer items-center gap-1.5 transition-colors"
              onclick={() => onSetOutletMode(outletMode === 'single' ? 'multi' : 'single')}
            >
              <div
                class="h-3 w-3 shrink-0 rounded-sm border transition-colors"
                class:border-zinc-500={outletMode === 'single'}
                class:bg-zinc-500={outletMode === 'single'}
                class:border-zinc-600={outletMode !== 'single'}
              ></div>
              <span
                class="text-xs"
                class:text-zinc-400={outletMode === 'single'}
                class:text-zinc-500={outletMode !== 'single'}
              >
                Single outlet
              </span>
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content>One merged outlet instead of one per track</Tooltip.Content>
        </Tooltip.Root>

        <!-- Manual clock -->
        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              class="flex cursor-pointer items-center gap-1.5 transition-colors"
              onclick={() => onSetClockMode(clockMode === 'manual' ? 'auto' : 'manual')}
            >
              <div
                class="h-3 w-3 shrink-0 rounded-sm border transition-colors"
                class:border-zinc-500={clockMode === 'manual'}
                class:bg-zinc-500={clockMode === 'manual'}
                class:border-zinc-600={clockMode !== 'manual'}
              ></div>
              <span
                class="text-xs"
                class:text-zinc-400={clockMode === 'manual'}
                class:text-zinc-500={clockMode !== 'manual'}
              >
                Manual clock
              </span>
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content>Advance one step per bang on the clock inlet</Tooltip.Content>
        </Tooltip.Root>

        <!-- Show in timeline -->
        <button
          class="flex cursor-pointer items-center gap-1.5 transition-colors"
          onclick={() => onSetShowInTimeline(!showInTimeline)}
        >
          <div
            class="h-3 w-3 shrink-0 rounded-sm border transition-colors"
            class:border-zinc-500={showInTimeline}
            class:bg-zinc-500={showInTimeline}
            class:border-zinc-600={!showInTimeline}
          ></div>
          <span
            class="text-xs"
            class:text-zinc-400={showInTimeline}
            class:text-zinc-500={!showInTimeline}
          >
            Show in timeline
          </span>
        </button>
      </div>
    </div>

    <!-- Swing -->
    <div>
      <label class="mb-2 block text-xs font-medium text-zinc-300">
        Swing: {swing}%
      </label>

      <SettingsSlider
        min={0}
        max={100}
        value={swing}
        onpointerdown={swingTracker.onFocus}
        onpointerup={swingTracker.onBlur}
        onchange={onSetSwing}
        class="nodrag"
      />
    </div>

    <!-- Tracks -->
    <div>
      <div class="mb-2 flex items-center justify-between">
        <label class="text-xs font-medium text-zinc-300">Tracks</label>
        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              onclick={onAddTrack}
              disabled={tracks.length >= 8}
              class="cursor-pointer rounded p-0.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Plus class="h-3.5 w-3.5" />
            </button>
          </Tooltip.Trigger>

          <Tooltip.Content>Add track (max 8)</Tooltip.Content>
        </Tooltip.Root>
      </div>

      <div class="space-y-1.5">
        {#each tracks as track, trackIdx (trackIdx)}
          <div class="flex items-center gap-1.5">
            <!-- Color swatch / native color picker -->
            <label class="relative cursor-pointer">
              <div
                class="h-5 w-5 rounded border border-zinc-600"
                style:background-color={track.color}
              ></div>
              <input
                type="color"
                value={track.color}
                onchange={(e) => onUpdateTrackColor(trackIdx, (e.target as HTMLInputElement).value)}
                class="absolute inset-0 h-0 w-0 opacity-0"
              />
            </label>

            <!-- Name -->
            <input
              type="text"
              value={track.name}
              onchange={(e) => onUpdateTrackName(trackIdx, (e.target as HTMLInputElement).value)}
              class="nodrag min-w-0 flex-1 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-300 outline-none focus:ring-1 focus:ring-zinc-500"
              maxlength="6"
            />

            <!-- Delete -->
            <Tooltip.Root>
              <Tooltip.Trigger>
                <button
                  onclick={() => onRemoveTrack(trackIdx)}
                  disabled={tracks.length <= 1}
                  class="cursor-pointer rounded p-0.5 text-zinc-600 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content>Remove track</Tooltip.Content>
            </Tooltip.Root>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
