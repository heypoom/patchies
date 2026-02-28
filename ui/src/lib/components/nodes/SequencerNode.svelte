<script lang="ts">
  import { match } from 'ts-pattern';
  import { onMount, onDestroy } from 'svelte';
  import { useSvelteFlow, useUpdateNodeInternals, useStore, type NodeProps } from '@xyflow/svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import { LookaheadClockScheduler } from '$lib/transport/ClockScheduler';
  import { SchedulerRegistry } from '$lib/transport/SchedulerRegistry';
  import { Transport } from '$lib/transport';
  import { useNodeDataTracker } from '$lib/history';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import SequencerSettings from '$lib/components/settings/SequencerSettings.svelte';
  import { Settings, X } from '@lucide/svelte/icons';

  export interface TrackData {
    name: string;
    color: string;
    stepOn: boolean[];
    stepValues: number[];
  }

  const DEFAULT_TRACKS: TrackData[] = [
    {
      name: 'KICK',
      color: '#e57373',
      stepOn: Array(16).fill(false),
      stepValues: Array(16).fill(1.0)
    },
    {
      name: 'SNARE',
      color: '#64b5f6',
      stepOn: Array(16).fill(false),
      stepValues: Array(16).fill(1.0)
    },
    {
      name: 'CHH',
      color: '#ffd54f',
      stepOn: Array(16).fill(false),
      stepValues: Array(16).fill(1.0)
    },
    {
      name: 'OHH',
      color: '#b39ddb',
      stepOn: Array(16).fill(false),
      stepValues: Array(16).fill(1.0)
    }
  ];

  // Palette for new tracks. Max 8 tracks (0–7 = single digit handle IDs).
  const TRACK_COLORS = [
    '#e57373',
    '#64b5f6',
    '#ffd54f',
    '#b39ddb',
    '#80cbc4',
    '#a5d6a7',
    '#ffb74d',
    '#ff8a65'
  ] as const;

  let {
    id: nodeId,
    data,
    selected
  }: NodeProps & {
    data: {
      steps?: number;
      tracks?: TrackData[];
      swing?: number;
      outputMode?: 'bang' | 'value' | 'audio';
      showVelocity?: boolean;
    };
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const store = useStore();
  const tracker = useNodeDataTracker(nodeId);
  const swingTracker = tracker.track('swing', () => data.swing ?? 0);

  let messageContext: MessageContext | null = null;
  let scheduler: LookaheadClockScheduler | null = null;
  let barSubId: string | null = null;
  let stepScheduleIds: string[] = [];
  let showSettings = $state(false);
  let currentVisualStep = $state(-1);
  let velocityDragOldTracks: TrackData[] | null = null;
  let pollingIntervalId: ReturnType<typeof setInterval> | null = null;

  const steps = $derived(data.steps ?? 16);
  const tracks = $derived((data.tracks ?? DEFAULT_TRACKS) as TrackData[]);
  const swing = $derived(data.swing ?? 0);
  const outputMode = $derived(data.outputMode ?? 'bang');

  const showVelocity = $derived(data.showVelocity ?? false);
  const trackCount = $derived(tracks.length);
  const stepsPerRow = $derived(Math.min(steps, 16));
  const rowCount = $derived(Math.ceil(steps / 16));

  function fireAtStep(stepIndex: number, time: number): void {
    if (!messageContext) return;

    const currentTracks = (data.tracks ?? DEFAULT_TRACKS) as TrackData[];
    const mode = outputMode;

    for (let t = 0; t < currentTracks.length; t++) {
      const track = currentTracks[t];
      if (!(track.stepOn[stepIndex] ?? false)) continue;

      const value = track.stepValues[stepIndex] ?? 1.0;

      const payload = match(mode)
        .with('audio', () => ({ type: 'set', time, value }))
        .with('value', () => value)
        .with('bang', () => ({ type: 'bang' }))
        .exhaustive();

      messageContext.send(payload, { to: t });
    }
  }

  function scheduleBar(barTime: number): void {
    // Cancel any leftover step schedules from the previous bar
    for (const id of stepScheduleIds) scheduler!.cancel(id);
    stepScheduleIds = [];

    const numSteps = data.steps ?? 16;
    const swingVal = data.swing ?? 0;
    const beatDuration = (60 / Transport.bpm) * (4 / Transport.denominator);
    const stepInterval = (beatDuration * Transport.beatsPerBar) / numSteps;

    // Swing operates at the 8th-note level: the off-beat 8th note in each beat pair is delayed.
    // halfBeat = steps per 8th note. For 8 steps in 4/4: halfBeat=1 → odd steps swung.
    // For 16 steps in 4/4: halfBeat=2 → steps 2,6,10,14 swung (the actual 8th off-beats).
    const stepsPerBeat = numSteps / Transport.beatsPerBar;
    const halfBeat = Math.max(1, Math.round(stepsPerBeat / 2));
    const eighthInterval = stepInterval * halfBeat;

    for (let i = 0; i < numSteps; i++) {
      const isSwung = swingVal > 0 && i % (halfBeat * 2) === halfBeat;
      const swingOffset = isSwung ? (swingVal / 100) * 0.5 * eighthInterval : 0;
      const stepTime = barTime + i * stepInterval + swingOffset;

      const id = scheduler!.schedule(stepTime, (t) => fireAtStep(i, t), {
        audio: outputMode === 'audio'
      });

      stepScheduleIds.push(id);
    }
  }

  function setupScheduler(): void {
    if (!scheduler) return;

    if (barSubId) {
      scheduler.cancel(barSubId);
      barSubId = null;
    }

    for (const id of stepScheduleIds) scheduler.cancel(id);
    stepScheduleIds = [];

    barSubId = scheduler.onBeat(0, (barTime) => scheduleBar(barTime), {
      audio: outputMode === 'audio'
    });
  }

  // Update xyflow handle positions when track count changes
  $effect(() => {
    trackCount;
    setTimeout(() => updateNodeInternals(nodeId), 0);
  });

  // Re-setup scheduler when outputMode changes so the audio flag is updated
  $effect(() => {
    outputMode;
    if (scheduler) setupScheduler();
  });

  onMount(() => {
    messageContext = new MessageContext(nodeId);

    scheduler = new LookaheadClockScheduler(() => ({
      time: Transport.seconds,
      beat: Transport.beat,
      bpm: Transport.bpm,
      phase: Transport.phase,
      beatsPerBar: Transport.beatsPerBar
    }));

    // hide the sequencer node from the timeline
    scheduler.setTimelineStyle({ visible: false });

    setupScheduler();
    scheduler.start();
    SchedulerRegistry.getInstance().register(nodeId, scheduler);

    pollingIntervalId = setInterval(() => {
      if (Transport.isPlaying) {
        const ppq = Transport.ppq;
        const bpb = Transport.beatsPerBar;
        const numSteps = data.steps ?? 16;
        const ticksPerBeat = ppq * (4 / Transport.denominator);
        const ticksPerBar = ticksPerBeat * bpb;
        const ticksPerStep = ticksPerBar / numSteps;
        const ticksInBar = Transport.ticks % ticksPerBar;
        currentVisualStep = Math.floor(ticksInBar / ticksPerStep) % numSteps;
      } else {
        currentVisualStep = -1;
      }
    }, 1000 / 30);
  });

  onDestroy(() => {
    if (pollingIntervalId) clearInterval(pollingIntervalId);
    if (scheduler) {
      SchedulerRegistry.getInstance().unregister(nodeId);
      scheduler.dispose();
    }
    messageContext?.destroy();
  });

  function toggleStep(trackIdx: number, stepIdx: number): void {
    const currentTracks = tracks.map((t) => ({ ...t, stepOn: [...t.stepOn] }));
    currentTracks[trackIdx].stepOn[stepIdx] = !currentTracks[trackIdx].stepOn[stepIdx];
    const oldTracks = tracks;
    updateNodeData(nodeId, { ...data, tracks: currentTracks });
    tracker.commit('tracks', oldTracks, currentTracks);
  }

  function setStepCount(newSteps: number): void {
    const newTracks = tracks.map((track) => ({
      ...track,
      stepOn: Array.from({ length: newSteps }, (_, i) => track.stepOn[i] ?? false),
      stepValues: Array.from({ length: newSteps }, (_, i) => track.stepValues[i] ?? 1.0)
    }));
    const oldSteps = steps;
    updateNodeData(nodeId, { ...data, steps: newSteps, tracks: newTracks });
    tracker.commit('steps', oldSteps, newSteps);
  }

  function addTrack(): void {
    if (tracks.length >= 8) return;
    const usedColors = new Set(tracks.map((t) => t.color));
    const nextColor = TRACK_COLORS.find((c) => !usedColors.has(c)) ?? TRACK_COLORS[0];
    const newTrack: TrackData = {
      name: `T${tracks.length + 1}`,
      color: nextColor,
      stepOn: Array(steps).fill(false),
      stepValues: Array(steps).fill(1.0)
    };
    const oldTracks = tracks;
    const newTracks = [...tracks, newTrack];
    updateNodeData(nodeId, { ...data, tracks: newTracks });
    tracker.commit('tracks', oldTracks, newTracks);
  }

  function removeTrack(trackIdx: number): void {
    if (tracks.length <= 1) return;
    const oldTracks = tracks;
    const newTracks = tracks.filter((_, i) => i !== trackIdx);
    updateNodeData(nodeId, { ...data, tracks: newTracks });
    tracker.commit('tracks', oldTracks, newTracks);
  }

  function updateTrackName(trackIdx: number, name: string): void {
    const newTracks = tracks.map((t, i) => (i === trackIdx ? { ...t, name } : t));
    updateNodeData(nodeId, { ...data, tracks: newTracks });
  }

  function updateTrackColor(trackIdx: number, color: string): void {
    const oldTracks = tracks;
    const newTracks = tracks.map((t, i) => (i === trackIdx ? { ...t, color } : t));
    updateNodeData(nodeId, { ...data, tracks: newTracks });
    tracker.commit('tracks', oldTracks, newTracks);
  }

  function setStepValue(trackIdx: number, stepIdx: number, value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    const newTracks = tracks.map((t, i) => {
      if (i !== trackIdx) return t;
      const newValues = [...t.stepValues];
      newValues[stepIdx] = clamped;
      return { ...t, stepValues: newValues };
    });
    updateNodeData(nodeId, { ...data, tracks: newTracks });
  }
</script>

<div class="relative">
  <!-- Main sequencer body -->
  <div class="group relative">
    <!-- Settings gear (visible on hover) -->
    {#if store.nodesDraggable}
      <div class="absolute -top-7 right-0 z-10">
        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              class="cursor-pointer rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700"
              class:opacity-100={showSettings}
              onclick={() => (showSettings = !showSettings)}
            >
              <Settings class="h-4 w-4 text-zinc-300" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content>Settings</Tooltip.Content>
        </Tooltip.Root>
      </div>
    {/if}

    <div class="rounded-md border border-zinc-700 bg-zinc-900 p-1.5">
      {#each tracks as track, trackIdx (trackIdx)}
        <div class="flex items-center gap-1.5 py-0.5">
          <!-- Track label -->
          <div
            class="w-10 shrink-0 overflow-hidden text-right font-mono text-[9px] leading-none tracking-widest uppercase"
            style:color={track.color}
            style:opacity="0.8"
          >
            {track.name}
          </div>

          <!-- Step grid: up to 16 per row, wrap for 24/32 -->
          <div class="flex flex-col gap-0.5">
            {#each Array.from({ length: rowCount }) as _, rowIdx (rowIdx)}
              <div class="nodrag flex gap-0.5">
                {#each Array.from({ length: stepsPerRow }) as _, colIdx (colIdx)}
                  {@const stepIdx = rowIdx * 16 + colIdx}
                  {#if stepIdx < steps}
                    {@const isOn = track.stepOn[stepIdx] ?? false}
                    {@const isCurrent = stepIdx === currentVisualStep}

                    <button
                      class={[
                        'w-[18px] cursor-pointer rounded-sm transition-all duration-75',
                        showVelocity ? 'h-[20px]' : 'h-[24px]'
                      ]}
                      class:ring-1={isCurrent}
                      class:ring-white={isCurrent}
                      class:ring-offset-0={isCurrent}
                      style:background-color={isOn ? track.color : '#3f3f46'}
                      style:opacity={isCurrent && !isOn ? '0.45' : '1'}
                      onclick={() => toggleStep(trackIdx, stepIdx)}
                      aria-label="Track {track.name} step {stepIdx + 1}"
                    ></button>
                  {/if}
                {/each}
              </div>

              {#if showVelocity}
                <div class="flex gap-0.5">
                  {#each Array.from({ length: stepsPerRow }) as _, colIdx (colIdx)}
                    {@const stepIdx = rowIdx * 16 + colIdx}

                    {#if stepIdx < steps}
                      {@const barValue = track.stepValues[stepIdx] ?? 1.0}
                      {@const isStepOn = track.stepOn[stepIdx] ?? false}
                      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                      <div
                        role="slider"
                        aria-valuenow={barValue}
                        aria-valuemin={0}
                        aria-valuemax={1}
                        tabindex="-1"
                        class="nodrag relative h-[48px] w-[18px] cursor-ns-resize overflow-hidden rounded-sm bg-zinc-800"
                        onpointerdown={(e) => {
                          e.stopPropagation();
                          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                          velocityDragOldTracks = tracks;
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setStepValue(trackIdx, stepIdx, 1 - (e.clientY - rect.top) / rect.height);
                        }}
                        onpointermove={(e) => {
                          if (!velocityDragOldTracks) return;
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setStepValue(trackIdx, stepIdx, 1 - (e.clientY - rect.top) / rect.height);
                        }}
                        onpointerup={() => {
                          if (!velocityDragOldTracks) return;
                          tracker.commit(
                            'tracks',
                            velocityDragOldTracks,
                            (data.tracks ?? DEFAULT_TRACKS) as TrackData[]
                          );
                          velocityDragOldTracks = null;
                        }}
                      >
                        <div
                          class="absolute right-0 bottom-0 left-0 rounded-sm"
                          style:background-color={track.color}
                          style:opacity={isStepOn ? '0.85' : '0.2'}
                          style:height="{barValue * 100}%"
                        />
                      </div>
                    {/if}
                  {/each}
                </div>
              {/if}
            {/each}
          </div>
        </div>
      {/each}
    </div>

    <!-- Dynamic outlets: one per track -->
    {#each tracks as track, trackIdx (trackIdx)}
      <StandardHandle
        port="outlet"
        id={trackIdx}
        title={track.name}
        total={tracks.length}
        index={trackIdx}
        {nodeId}
      />
    {/each}
  </div>

  <!-- Settings panel -->
  {#if showSettings}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="absolute top-0 z-20"
      style="left: calc(100% + 8px)"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="absolute -top-7 right-0 flex gap-x-1">
        <button
          onclick={() => (showSettings = false)}
          class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <SequencerSettings
        {steps}
        {swing}
        {outputMode}
        {showVelocity}
        {tracks}
        {swingTracker}
        onSetStepCount={setStepCount}
        onSetSwing={(v) => updateNodeData(nodeId, { ...data, swing: v })}
        onSetOutputMode={(v) => {
          updateNodeData(nodeId, { ...data, outputMode: v });
          tracker.commit('outputMode', outputMode, v);
        }}
        onSetShowVelocity={(v) => {
          updateNodeData(nodeId, { ...data, showVelocity: v });
          tracker.commit('showVelocity', showVelocity, v);
        }}
        onAddTrack={addTrack}
        onRemoveTrack={removeTrack}
        onUpdateTrackName={updateTrackName}
        onUpdateTrackColor={updateTrackColor}
      />
    </div>
  {/if}
</div>
