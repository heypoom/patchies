<script lang="ts">
  import { match } from 'ts-pattern';
  import { onMount, onDestroy } from 'svelte';
  import { useSvelteFlow, useUpdateNodeInternals, useStore, type NodeProps } from '@xyflow/svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import { SequencerScheduler } from '../../sequencer/sequencer-scheduler';
  import { type TrackData, DEFAULT_TRACKS, TRACK_COLORS } from '$lib/nodes/sequencer-constants';
  import { useNodeDataTracker } from '$lib/history';
  import { sequencerMessages } from '$lib/objects/schemas';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import SequencerSettings from '$lib/components/settings/SequencerSettings.svelte';
  import { Settings, VolumeX, X } from '@lucide/svelte/icons';

  type NodeData = {
    steps?: number;
    tracks?: TrackData[];
    swing?: number;
    outputMode?: 'bang' | 'value' | 'audio';
    clockMode?: 'auto' | 'manual';
    showVelocity?: boolean;
    showInTimeline?: boolean;
    muted?: boolean;
  };

  let {
    id: nodeId,
    data,
    selected
  }: NodeProps & {
    data: NodeData;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const store = useStore();
  const tracker = useNodeDataTracker(nodeId);
  const swingTracker = tracker.track('swing', () => data.swing ?? 0);

  let messageContext: MessageContext | null = null;
  let schedulerHandle: SequencerScheduler | null = null;
  let showSettings = $state(false);
  let currentVisualStep = $state(-1);
  let manualStep = $state(0);
  let velocityDragOldTracks: TrackData[] | null = null;
  let pollingIntervalId: ReturnType<typeof setInterval> | null = null;

  const steps = $derived(data.steps ?? 16);
  const tracks = $derived((data.tracks ?? DEFAULT_TRACKS) as TrackData[]);
  const swing = $derived(data.swing ?? 0);
  const outputMode = $derived(data.outputMode ?? 'bang');
  const clockMode = $derived(data.clockMode ?? 'auto');

  const showVelocity = $derived(data.showVelocity ?? false);
  const showInTimeline = $derived(data.showInTimeline ?? true);
  const muted = $derived(data.muted ?? false);
  const trackCount = $derived(tracks.length);
  const stepsPerRow = $derived(Math.min(steps, 16));
  const rowCount = $derived(Math.ceil(steps / 16));

  function fireAtStep(stepIndex: number, time: number): void {
    if (!messageContext || data.muted) return;

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

  function setNodeData<T extends keyof NodeData>(key: T, value: NodeData[T]): void {
    updateNodeData(nodeId, { ...data, [key]: value });
    tracker.commit(key, data[key], value);
  }

  function applyTracks(newTracks: TrackData[]): void {
    const oldTracks = tracks;
    updateNodeData(nodeId, { ...data, tracks: newTracks });
    tracker.commit('tracks', oldTracks, newTracks);
  }

  function handleInletMessage(raw: unknown): void {
    match(raw)
      // --- Manual clock ---
      .with(sequencerMessages.bang, () => {
        if (clockMode !== 'manual') return;
        const step = manualStep;

        const audioTime =
          outputMode === 'audio' ? AudioService.getInstance().getAudioContext().currentTime : 0;

        fireAtStep(step, audioTime);

        currentVisualStep = step;
        manualStep = (step + 1) % steps;
      })
      .with(sequencerMessages.reset, () => {
        if (clockMode !== 'manual') return;
        manualStep = 0;
        currentVisualStep = 0;
      })
      .with(sequencerMessages.goto, ({ step }) => {
        if (clockMode !== 'manual') return;
        const clamped = Math.max(0, Math.min(steps - 1, step));
        manualStep = clamped;
        currentVisualStep = clamped;
      })

      // --- Step control ---
      .with(sequencerMessages.setStep, ({ track, step, on }) => {
        if (track < 0 || track >= tracks.length || step < 0 || step >= steps) return;
        applyTracks(
          tracks.map((t, i) => {
            if (i !== track) return t;
            const newOn = [...t.stepOn];
            newOn[step] = on;
            return { ...t, stepOn: newOn };
          })
        );
      })
      .with(sequencerMessages.setVelocityAll, ({ track, values }) => {
        if (track < 0 || track >= tracks.length) return;

        applyTracks(
          tracks.map((t, i) => {
            if (i !== track) return t;

            const newValues = Array.from({ length: steps }, (_, j) =>
              Math.max(0, Math.min(1, values[j] ?? t.stepValues[j] ?? 1.0))
            );

            return { ...t, stepValues: newValues };
          })
        );
      })
      .with(sequencerMessages.setVelocityOne, ({ track, step, value }) => {
        if (track < 0 || track >= tracks.length || step < 0 || step >= steps) return;

        applyTracks(
          tracks.map((t, i) => {
            if (i !== track) return t;

            const newValues = [...t.stepValues];
            newValues[step] = Math.max(0, Math.min(1, value));

            return { ...t, stepValues: newValues };
          })
        );
      })
      .with(sequencerMessages.setPattern, ({ track, pattern }) => {
        if (track < 0 || track >= tracks.length) return;

        applyTracks(
          tracks.map((t, i) => {
            if (i !== track) return t;

            return { ...t, stepOn: Array.from({ length: steps }, (_, j) => pattern[j] ?? false) };
          })
        );
      })

      // --- Pattern manipulation (specific track matched before all-tracks) ---
      .with(sequencerMessages.clearTrack, ({ track }) => {
        if (track < 0 || track >= tracks.length) return;

        applyTracks(
          tracks.map((t, i) => (i === track ? { ...t, stepOn: Array(steps).fill(false) } : t))
        );
      })
      .with(sequencerMessages.clearAll, () => {
        applyTracks(tracks.map((t) => ({ ...t, stepOn: Array(steps).fill(false) })));
      })
      .with(sequencerMessages.fillTrack, ({ track }) => {
        if (track < 0 || track >= tracks.length) return;

        applyTracks(
          tracks.map((t, i) => (i === track ? { ...t, stepOn: Array(steps).fill(true) } : t))
        );
      })
      .with(sequencerMessages.fillAll, () => {
        applyTracks(tracks.map((t) => ({ ...t, stepOn: Array(steps).fill(true) })));
      })
      .with(sequencerMessages.randomAll, () => {
        applyTracks(
          tracks.map((t) => ({
            ...t,
            stepOn: Array.from({ length: steps }, () => Math.random() < 0.5),
            stepValues: Array.from({ length: steps }, () => Math.random())
          }))
        );
      })
      .with(sequencerMessages.rotate, ({ track, amount }) => {
        if (track < 0 || track >= tracks.length) return;

        const n = steps;
        const shift = ((amount % n) + n) % n;

        applyTracks(
          tracks.map((t, i) => {
            if (i !== track) return t;

            return {
              ...t,
              stepOn: [...t.stepOn.slice(n - shift), ...t.stepOn.slice(0, n - shift)],
              stepValues: [...t.stepValues.slice(n - shift), ...t.stepValues.slice(0, n - shift)]
            };
          })
        );
      })

      // --- Config ---
      .with(sequencerMessages.setSwing, ({ value }) => {
        const clamped = Math.max(0, Math.min(100, value));

        setNodeData('swing', clamped);
      })
      .with(sequencerMessages.setOutputMode, ({ value }) => {
        setNodeData('outputMode', value);
      })
      .with(sequencerMessages.setClockMode, ({ value }) => {
        setNodeData('clockMode', value);
      })
      .with(sequencerMessages.setStepCount, ({ value }) => {
        setStepCount(value);
      })
      .with(sequencerMessages.mute, () => setNodeData('muted', true))
      .with(sequencerMessages.unmute, () => setNodeData('muted', false))
      .otherwise(() => {});
  }

  // Update xyflow handle positions when track count or clockMode changes
  $effect(() => {
    trackCount;
    clockMode;
    setTimeout(() => updateNodeInternals(nodeId), 0);
  });

  // Re-setup scheduler when outputMode or clockMode changes
  $effect(() => {
    outputMode;
    clockMode;
    schedulerHandle?.setup();
  });

  // Immediately clear timeline markers when muted or showInTimeline is disabled
  $effect(() => {
    if (muted || !showInTimeline) {
      schedulerHandle?.clearMarkers();
    }
  });

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.messageCallback = handleInletMessage;

    schedulerHandle = new SequencerScheduler(
      nodeId,
      () => ({ clockMode, outputMode, steps, swing }),
      fireAtStep,
      (step) => {
        if (!(data.showInTimeline ?? true) || (data.muted ?? false)) return [];

        const currentTracks = (data.tracks ?? DEFAULT_TRACKS) as TrackData[];

        return currentTracks
          .filter((t) => (t.stepOn[step] ?? false) && (t.stepValues[step] ?? 1.0) > 0)
          .map((t) => t.color);
      }
    );

    schedulerHandle.start();

    pollingIntervalId = setInterval(() => {
      if (clockMode === 'manual') return;
      currentVisualStep = schedulerHandle!.getVisualStep(steps);
    }, 1000 / 30);
  });

  onDestroy(() => {
    if (pollingIntervalId) clearInterval(pollingIntervalId);
    schedulerHandle?.dispose();
    messageContext?.destroy();
  });

  function toggleStep(trackIdx: number, stepIdx: number): void {
    applyTracks(
      tracks.map((t, i) => {
        if (i !== trackIdx) return t;
        const newOn = [...t.stepOn];
        newOn[stepIdx] = !newOn[stepIdx];
        return { ...t, stepOn: newOn };
      })
    );
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

    applyTracks([
      ...tracks,
      {
        name: `T${tracks.length + 1}`,
        color: nextColor,
        stepOn: Array(steps).fill(false),
        stepValues: Array(steps).fill(1.0)
      }
    ]);
  }

  function removeTrack(trackIdx: number): void {
    if (tracks.length <= 1) return;
    applyTracks(tracks.filter((_, i) => i !== trackIdx));
  }

  function updateTrackName(trackIdx: number, name: string): void {
    applyTracks(tracks.map((t, i) => (i === trackIdx ? { ...t, name } : t)));
  }

  function updateTrackColor(trackIdx: number, color: string): void {
    applyTracks(tracks.map((t, i) => (i === trackIdx ? { ...t, color } : t)));
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
    <!-- Header buttons (visible on hover, mute always visible when active) -->
    {#if store.nodesDraggable}
      <div class="absolute -top-7 right-0 z-10 flex items-center">
        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              class="cursor-pointer rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700"
              class:text-red-400={muted}
              class:text-zinc-300={!muted}
              onclick={() => setNodeData('muted', !muted)}
            >
              <VolumeX class="h-4 w-4" />
            </button>
          </Tooltip.Trigger>

          <Tooltip.Content>{muted ? 'Unmute' : 'Mute'}</Tooltip.Content>
        </Tooltip.Root>

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

    <div
      class={[
        'rounded-md border bg-zinc-900 p-1.5 transition-opacity',
        selected ? 'border-zinc-600' : 'border-zinc-800',
        muted ? 'opacity-40' : 'opacity-100'
      ]}
    >
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

    <!-- Control inlet: always present, smart-hidden when not connected -->
    <StandardHandle port="inlet" type="message" title="Control" total={1} index={0} {nodeId} />

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
        {clockMode}
        {showVelocity}
        {showInTimeline}
        {tracks}
        {swingTracker}
        onSetStepCount={setStepCount}
        onSetSwing={(v) => updateNodeData(nodeId, { ...data, swing: v })}
        onSetOutputMode={(v) => setNodeData('outputMode', v)}
        onSetClockMode={(v) => setNodeData('clockMode', v)}
        onSetShowVelocity={(v) => setNodeData('showVelocity', v)}
        onSetShowInTimeline={(v) => setNodeData('showInTimeline', v)}
        onAddTrack={addTrack}
        onRemoveTrack={removeTrack}
        onUpdateTrackName={updateTrackName}
        onUpdateTrackColor={updateTrackColor}
      />
    </div>
  {/if}
</div>
