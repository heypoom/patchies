<script lang="ts">
  import {
    NodeResizer,
    useSvelteFlow,
    useUpdateNodeInternals,
    useStore,
    type NodeProps
  } from '@xyflow/svelte';
  import type { OutletMode, SequencerOutputMode } from './sequencer-output';
  import { getHeightForTrackCountChange } from './sequencer-layout';
  import { getSequencerVisualStep } from './sequencer-scheduler';
  import { type TrackData, DEFAULT_TRACKS, TRACK_COLORS } from '$lib/nodes/sequencer-constants';
  import { useNodeDataTracker } from '$lib/history';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { SequencerObject, type SequencerData } from '$objects/sequencer/SequencerObject';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import SequencerSettings from '$lib/components/settings/SequencerSettings.svelte';
  import { Settings, VolumeX, X } from '@lucide/svelte/icons';
  import { useSettingsSidebarTarget } from '$lib/settings/use-settings-sidebar-target.svelte';
  import { useUpdateNodeData } from '$lib/composables/useUpdateNodeData.svelte';

  let {
    id: nodeId,
    data,
    selected,
    width: persistedWidth,
    height: persistedHeight
  }: NodeProps & {
    data: SequencerData;
  } = $props();

  const store = useStore();
  const { updateNodeData, updateNode } = useSvelteFlow();
  const updateData = useUpdateNodeData();
  const updateNodeInternals = useUpdateNodeInternals();

  function getInitialNodeId() {
    return nodeId;
  }

  const tracker = useNodeDataTracker(getInitialNodeId());
  const swingTracker = tracker.track('swing', () => data.swing ?? 0);

  let showSettings = $state(false);
  let currentVisualStep = $state(-1);
  let velocityDragOldTracks: TrackData[] | null = null;

  const steps = $derived(data.steps ?? 16);
  const tracks = $derived((data.tracks ?? DEFAULT_TRACKS) as TrackData[]);
  const swing = $derived(data.swing ?? 0);
  const outletMode = $derived(data.outletMode ?? 'multi');
  const outputMode = $derived(data.outputMode ?? (outletMode === 'single' ? 'index' : 'bang'));
  const audioRate = $derived(data.audioRate ?? false);
  const clockMode = $derived(data.clockMode ?? 'auto');

  const showVelocity = $derived(data.showVelocity ?? false);
  const showInTimeline = $derived(data.showInTimeline ?? true);
  const resizable = $derived(data.resizable ?? false);
  const muted = $derived(data.muted ?? false);
  const trackCount = $derived(tracks.length);
  const stepsPerRow = $derived(Math.min(steps, 16));
  const rowCount = $derived(Math.ceil(steps / 16));

  const defaultGridHeight = $derived(
    showVelocity ? rowCount * 70 + (rowCount - 1) * 2 : rowCount * 24 + (rowCount - 1) * 2
  );

  const defaultNodeWidth = $derived(58 + stepsPerRow * 20);
  const defaultNodeHeight = $derived(14 + trackCount * (4 + defaultGridHeight));

  const nodeWidth = $derived(persistedWidth ?? defaultNodeWidth);
  const nodeHeight = $derived(persistedHeight ?? defaultNodeHeight);
  const scale = $derived(nodeWidth / defaultNodeWidth);

  function setNodeData<T extends keyof SequencerData>(key: T, value: SequencerData[T]): void {
    updateNodeData(nodeId, { [key]: value });
    tracker.commit(key, data[key], value);
  }

  function setShowVelocity(value: boolean): void {
    if (value !== showVelocity) {
      updateNode(nodeId, { height: nodeHeight * (value ? 2 : 0.5) });
    }

    setNodeData('showVelocity', value);
  }

  function applyTracks(getNewTracks: (data: SequencerData) => TrackData[]): void {
    let oldTracks = tracks;
    let newTracks = oldTracks;

    updateData<SequencerData>(nodeId, (data) => {
      oldTracks = (data.tracks ?? DEFAULT_TRACKS) as TrackData[];
      newTracks = getNewTracks(data);

      return { tracks: newTracks };
    });

    if (newTracks.length !== oldTracks.length) {
      updateNode(nodeId, {
        height: getHeightForTrackCountChange(
          nodeHeight,
          oldTracks.length,
          newTracks.length,
          defaultGridHeight,
          scale
        )
      });
    }

    tracker.commit('tracks', oldTracks, newTracks);
  }

  // Update xyflow handle positions when track count, clockMode, or outletMode changes
  $effect(() => {
    void trackCount;
    void clockMode;
    void outletMode;

    setTimeout(() => updateNodeInternals(nodeId), 0);
  });

  $effect(() => {
    const pollingIntervalId = setInterval(() => {
      currentVisualStep =
        clockMode === 'manual' ? (data.currentStep ?? -1) : getSequencerVisualStep(steps);
    }, 1000 / 30);

    return () => clearInterval(pollingIntervalId);
  });

  function toggleStep(trackIdx: number, stepIdx: number): void {
    applyTracks((data) => {
      const currentTracks = (data.tracks ?? DEFAULT_TRACKS) as TrackData[];

      return currentTracks.map((t, i) => {
        if (i !== trackIdx) return t;

        const newOn = [...t.stepOn];
        newOn[stepIdx] = !newOn[stepIdx];

        return { ...t, stepOn: newOn };
      });
    });
  }

  function setStepCount(newSteps: number): void {
    let oldSteps = steps;

    updateData<SequencerData>(nodeId, (data) => {
      oldSteps = data.steps ?? 16;
      const currentTracks = (data.tracks ?? DEFAULT_TRACKS) as TrackData[];
      const newTracks = currentTracks.map((track) => ({
        ...track,
        stepOn: Array.from({ length: newSteps }, (_, i) => track.stepOn[i] ?? false),
        stepValues: Array.from({ length: newSteps }, (_, i) => track.stepValues[i] ?? 1.0)
      }));

      return { steps: newSteps, tracks: newTracks };
    });

    tracker.commit('steps', oldSteps, newSteps);
  }

  function addTrack(): void {
    applyTracks((data) => {
      const currentTracks = (data.tracks ?? DEFAULT_TRACKS) as TrackData[];
      if (currentTracks.length >= 8) return currentTracks;

      const usedColors = new Set(currentTracks.map((t) => t.color));
      const nextColor = TRACK_COLORS.find((c) => !usedColors.has(c)) ?? TRACK_COLORS[0];
      const currentSteps = data.steps ?? 16;

      return [
        ...currentTracks,
        {
          name: `T${currentTracks.length + 1}`,
          color: nextColor,
          stepOn: Array(currentSteps).fill(false),
          stepValues: Array(currentSteps).fill(1.0)
        }
      ];
    });
  }

  function removeTrack(trackIdx: number): void {
    applyTracks((data) => {
      const currentTracks = (data.tracks ?? DEFAULT_TRACKS) as TrackData[];
      if (currentTracks.length <= 1) return currentTracks;

      return currentTracks.filter((_, i) => i !== trackIdx);
    });
  }

  const updateTrackName = (trackIdx: number, name: string): void =>
    applyTracks((data) => {
      const currentTracks = (data.tracks ?? DEFAULT_TRACKS) as TrackData[];

      return currentTracks.map((t, i) => (i === trackIdx ? { ...t, name } : t));
    });

  const updateTrackColor = (trackIdx: number, color: string): void =>
    applyTracks((data) => {
      const currentTracks = (data.tracks ?? DEFAULT_TRACKS) as TrackData[];

      return currentTracks.map((t, i) => (i === trackIdx ? { ...t, color } : t));
    });

  function setStepValue(trackIdx: number, stepIdx: number, value: number): void {
    const clamped = Math.max(0, Math.min(1, value));

    updateData<SequencerData>(nodeId, (data) => {
      const currentTracks = (data.tracks ?? DEFAULT_TRACKS) as TrackData[];
      const newTracks = currentTracks.map((t, i) => {
        if (i !== trackIdx) return t;

        const newValues = [...t.stepValues];
        newValues[stepIdx] = clamped;

        return { ...t, stepValues: newValues };
      });

      return { tracks: newTracks };
    });
  }

  const settingsSidebarTarget = useSettingsSidebarTarget({
    getTarget: () => ({ id: nodeId, label: 'sequencer', content: sidebarSettings }),
    floating: {
      isOpen: () => showSettings,
      setOpen: (open) => (showSettings = open)
    }
  });
</script>

{#snippet sequencerSettings(variant: 'floating' | 'sidebar')}
  <SequencerSettings
    {steps}
    {swing}
    {outletMode}
    {outputMode}
    {audioRate}
    {clockMode}
    {showVelocity}
    {showInTimeline}
    {resizable}
    {tracks}
    {swingTracker}
    onSetStepCount={setStepCount}
    onSetSwing={(v) => updateNodeData(nodeId, { swing: v })}
    onSetOutletMode={(v: OutletMode) => {
      const newOutput = v === 'single' ? 'index' : 'bang';

      const oldData = { outletMode, outputMode };
      const newData = { outletMode: v, outputMode: newOutput };
      updateNodeData(nodeId, newData);
      tracker.commit('outletMode', oldData, newData);
    }}
    onSetOutputMode={(v: string) => setNodeData('outputMode', v as SequencerOutputMode)}
    onSetAudioRate={(v) => setNodeData('audioRate', v)}
    onSetClockMode={(v) => setNodeData('clockMode', v)}
    onSetShowVelocity={setShowVelocity}
    onSetShowInTimeline={(v) => setNodeData('showInTimeline', v)}
    onSetResizable={(v) => setNodeData('resizable', v)}
    onAddTrack={addTrack}
    onRemoveTrack={removeTrack}
    onUpdateTrackName={updateTrackName}
    onUpdateTrackColor={updateTrackColor}
    {variant}
  />
{/snippet}

{#snippet sidebarSettings()}
  {@render sequencerSettings('sidebar')}
{/snippet}

<div class="relative h-full" style:width="{nodeWidth}px" style:height="{nodeHeight}px">
  <NodeResizer
    isVisible={selected && resizable}
    minWidth={defaultNodeWidth}
    minHeight={defaultNodeHeight}
    keepAspectRatio
  />

  <!-- Main sequencer body -->
  <div class="group relative h-full">
    <!-- Header buttons (visible on hover, mute always visible when active) -->
    {#if store.nodesDraggable}
      <div class="absolute -top-7 right-0 z-10 flex items-center">
        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              class="cursor-pointer rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 [@media(hover:none)]:opacity-100"
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
              class="cursor-pointer rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 [@media(hover:none)]:opacity-100"
              class:opacity-100={showSettings}
              onclick={(event) => settingsSidebarTarget.toggle(event)}
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
        'flex h-full flex-col rounded-md border bg-zinc-900 transition-opacity',
        selected ? 'border-zinc-600' : 'border-zinc-800',
        muted ? 'opacity-40' : 'opacity-100'
      ]}
      style:padding="{6 * scale}px"
    >
      {#each tracks as track, trackIdx (trackIdx)}
        <div
          class="flex min-h-0 w-full flex-1 items-center"
          style:gap="{6 * scale}px"
          style:padding-top="{2 * scale}px"
          style:padding-bottom="{2 * scale}px"
        >
          <!-- Track label -->
          <div
            class="shrink-0 overflow-hidden text-right font-mono leading-none tracking-widest uppercase"
            style:color={track.color}
            style:opacity="0.8"
            style:width="{40 * scale}px"
            style:font-size="{9 * scale}px"
          >
            {track.name}
          </div>

          <!-- Step grid: up to 16 per row, wrap for 24/32 -->
          <div class="flex h-full min-w-0 flex-1 flex-col" style:gap="{2 * scale}px">
            {#each Array.from({ length: rowCount }) as _, rowIdx (rowIdx)}
              <div class="flex min-h-0 flex-1 flex-col" style:gap="{2 * scale}px">
                <div class="nodrag flex min-h-0 flex-[5]" style:gap="{2 * scale}px">
                  {#each Array.from({ length: stepsPerRow }) as _, colIdx (colIdx)}
                    {@const stepIdx = rowIdx * 16 + colIdx}

                    {#if track && stepIdx < steps}
                      {@const isOn = track.stepOn?.[stepIdx] ?? false}
                      {@const isCurrent = stepIdx === currentVisualStep}

                      <button
                        class="h-full min-w-0 flex-1 cursor-pointer rounded-sm transition-all duration-75"
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
                  <div class="flex min-h-0 flex-[12]" style:gap="{2 * scale}px">
                    {#each Array.from({ length: stepsPerRow }) as _, colIdx (colIdx)}
                      {@const stepIdx = rowIdx * 16 + colIdx}

                      {#if track && stepIdx < steps}
                        {@const barValue = track.stepValues?.[stepIdx] ?? 1.0}
                        {@const isStepOn = track.stepOn?.[stepIdx] ?? false}

                        <div
                          role="slider"
                          aria-valuenow={barValue}
                          aria-valuemin={0}
                          aria-valuemax={1}
                          tabindex="-1"
                          class="nodrag relative h-full min-w-0 flex-1 cursor-ns-resize overflow-hidden rounded-sm bg-zinc-800"
                          onpointerdown={(e) => {
                            e.stopPropagation();
                            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                            velocityDragOldTracks = tracks;
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setStepValue(
                              trackIdx,
                              stepIdx,
                              1 - (e.clientY - rect.top) / rect.height
                            );
                          }}
                          onpointermove={(e) => {
                            if (!velocityDragOldTracks) return;
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setStepValue(
                              trackIdx,
                              stepIdx,
                              1 - (e.clientY - rect.top) / rect.height
                            );
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
                          ></div>
                        </div>
                      {/if}
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>

    <!-- Control inlet: always present, smart-hidden when not connected -->
    <TypedHandle
      port="inlet"
      spec={SequencerObject.inlets[0].handle!}
      title="Control"
      total={1}
      index={0}
      {nodeId}
    />

    <!-- Outlets: single or per-track -->
    {#if outletMode === 'single'}
      <StandardHandle port="outlet" id={0} title="out" total={1} index={0} {nodeId} />
    {:else}
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
    {/if}
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

      {@render sequencerSettings('floating')}
    </div>
  {/if}
</div>
