<script lang="ts">
  import type { ContinuousTracker } from '$lib/history';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import SettingsSlider from '$lib/components/SettingsSlider.svelte';
  import { Plus, Trash2 } from '@lucide/svelte/icons';
  import type { TrackData } from '$lib/components/nodes/SequencerNode.svelte';

  const STEP_COUNTS = [4, 8, 12, 16, 24, 32] as const;

  let {
    steps,
    swing,
    audioRate,
    outputFormat,
    showVelocity,
    tracks,
    swingTracker,
    onSetStepCount,
    onSetSwing,
    onSetAudioRate,
    onSetOutputFormat,
    onSetShowVelocity,
    onAddTrack,
    onRemoveTrack,
    onUpdateTrackName,
    onUpdateTrackColor
  }: {
    steps: number;
    swing: number;
    audioRate: boolean;
    outputFormat: 'bang' | 'value';
    showVelocity: boolean;
    tracks: TrackData[];
    swingTracker: ContinuousTracker;
    onSetStepCount: (n: number) => void;
    onSetSwing: (v: number) => void;
    onSetAudioRate: (v: boolean) => void;
    onSetOutputFormat: (v: 'bang' | 'value') => void;
    onSetShowVelocity: (v: boolean) => void;
    onAddTrack: () => void;
    onRemoveTrack: (idx: number) => void;
    onUpdateTrackName: (idx: number, name: string) => void;
    onUpdateTrackColor: (idx: number, color: string) => void;
  } = $props();
</script>

<div class="nodrag w-56 rounded-md border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
  <div class="space-y-4">
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

    <!-- Audio Rate -->
    <div class="flex items-center justify-between">
      <label class="text-xs font-medium text-zinc-300">Audio Rate</label>

      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            onclick={() => onSetAudioRate(!audioRate)}
            class="cursor-pointer rounded px-2 py-1 text-xs transition-colors"
            class:bg-zinc-600={audioRate}
            class:text-white={audioRate}
            class:bg-zinc-800={!audioRate}
            class:text-zinc-400={!audioRate}
            class:hover:bg-zinc-700={!audioRate}
          >
            {audioRate ? 'On' : 'Off'}
          </button>
        </Tooltip.Trigger>

        <Tooltip.Content>
          {audioRate
            ? 'Sends {time, value} — suitable for Web Audio scheduling'
            : 'Sends value — suitable for visual/message scheduling'}
        </Tooltip.Content>
      </Tooltip.Root>
    </div>

    <!-- Output Format -->
    <div class="flex items-center justify-between" class:opacity-50={audioRate}>
      <label class="text-xs font-medium text-zinc-300">Output</label>

      <div class="flex gap-1">
        {#each ['bang', 'value'] as const as fmt}
          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                onclick={() => !audioRate && onSetOutputFormat(fmt)}
                disabled={audioRate}
                class="cursor-pointer rounded px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed"
                class:bg-zinc-600={outputFormat === fmt && !audioRate}
                class:text-white={outputFormat === fmt && !audioRate}
                class:bg-zinc-800={outputFormat !== fmt || audioRate}
                class:text-zinc-300={outputFormat !== fmt}
                class:hover:bg-zinc-700={outputFormat !== fmt && !audioRate}
              >
                {fmt}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content>
              {fmt === 'bang'
                ? 'Sends {type: "bang"} — works with sampler~, trigger, etc.'
                : 'Sends velocity value (0–1)'}
            </Tooltip.Content>
          </Tooltip.Root>
        {/each}
      </div>
    </div>

    <!-- Velocity Lane -->
    <div class="flex items-center justify-between">
      <label class="text-xs font-medium text-zinc-300">Velocity Lane</label>

      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            onclick={() => onSetShowVelocity(!showVelocity)}
            class="cursor-pointer rounded px-2 py-1 text-xs transition-colors"
            class:bg-zinc-600={showVelocity}
            class:text-white={showVelocity}
            class:bg-zinc-800={!showVelocity}
            class:text-zinc-400={!showVelocity}
            class:hover:bg-zinc-700={!showVelocity}
          >
            {showVelocity ? 'On' : 'Off'}
          </button>
        </Tooltip.Trigger>

        <Tooltip.Content>Show per-step velocity bars (drag to set 0–1)</Tooltip.Content>
      </Tooltip.Root>
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
