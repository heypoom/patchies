<script lang="ts">
  import { Transport } from '$lib/transport';
  import { transportStore, type TimeDisplayFormat } from '../../../stores/transport.store';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import { Slider } from '$lib/components/ui/slider';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { Play, Pause, Square, Volume2, VolumeX, Volume, Volume1 } from '@lucide/svelte/icons';
  import { onMount } from 'svelte';
  import { match } from 'ts-pattern';
  import TimelineRuler from './TimelineRuler.svelte';

  const audioService = AudioService.getInstance();

  // Timeline ruler resize state
  let rulerWidth = $state(500);
  let isResizing = $state(false);

  function onResizePointerDown(e: PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rulerWidth;
    isResizing = true;

    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      // Dragging left increases width (panel is right-docked)
      rulerWidth = Math.max(200, Math.min(1200, startWidth - (ev.clientX - startX)));
    };

    const onUp = () => {
      isResizing = false;
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
    };

    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  }

  // Transport state (updated via polling)
  let isPlaying = $state(false);
  let seconds = $state(0);
  let beat = $state(0);
  let bar = $state(0);
  let phase = $state(0);
  let bpm = $state(120);
  let beatsPerBar = $state(4);
  let denominator = $state(4);

  // Volume state (independent of DSP)
  let volume = $state(0.8);
  let isMuted = $state(false);
  let previousVolume = 0.8;

  // DSP state (independent of volume/mute)
  let isDspEnabled = $state(true);

  // Time edit state
  let isEditingTime = $state(false);
  let editTimeValue = $state('');
  let timeInputRef: HTMLInputElement | null = null;
  let clickTimer: ReturnType<typeof setTimeout> | null = null;

  // Format time display
  const timeDisplay = $derived.by(() => {
    return match($transportStore.timeDisplayFormat)
      .with('seconds', () => formatSeconds(seconds))
      .with('bars', () => formatBars(bar, beat, phase))
      .with('time', () => formatTime(seconds))
      .exhaustive();
  });

  const formatSeconds = (secs: number): string => `${secs.toFixed(2).padStart(8, '0')}`;

  function formatTime(secs: number): string {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 100);

    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`;
  }

  function formatBars(currentBar: number, currentBeat: number, currentPhase: number): string {
    // Display as 0-indexed to match clock scheduling API (like Tone.js)
    const sixteenths = Math.floor(currentPhase * 4);
    let beatPad = beatsPerBar > 9 ? 2 : 1;

    return `${currentBar.toString().padStart(4, '0')}:${currentBeat.toString().padStart(beatPad, '0')}:${sixteenths.toString()}`;
  }

  // Volume icon
  const volumeIcon = $derived.by(() => {
    if (isMuted || volume === 0) return VolumeX;

    if (volume < 0.33) return Volume;
    if (volume < 0.66) return Volume1;

    return Volume2;
  });

  // Handlers
  async function handlePlay() {
    await Transport.play();
  }

  function handlePause() {
    Transport.pause();
  }

  function handleStop() {
    Transport.stop();
  }

  function handleBpmChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const newBpm = parseFloat(target.value);

    if (!isNaN(newBpm) && newBpm > 0 && newBpm <= 999) {
      Transport.setBpm(newBpm);
      transportStore.setBpm(newBpm);
    }
  }

  // Time signature edit state
  let isEditingTimeSig = $state(false);
  let editTimeSigValue = $state('');
  let timeSigInputRef: HTMLInputElement | null = null;

  const timeSigDisplay = $derived(`${beatsPerBar}/${denominator}`);

  function enterTimeSigEditMode() {
    editTimeSigValue = timeSigDisplay;
    isEditingTimeSig = true;

    requestAnimationFrame(() => timeSigInputRef?.select());
  }

  function handleTimeSigEditComplete() {
    const parsed = parseTimeSigInput(editTimeSigValue);

    if (parsed) {
      Transport.setTimeSignature(parsed.numerator, parsed.denominator);
    }

    isEditingTimeSig = false;
  }

  function handleTimeSigKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTimeSigEditComplete();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      isEditingTimeSig = false;
    }
  }

  function parseTimeSigInput(input: string): { numerator: number; denominator: number } | null {
    const parts = input.split('/').map((s) => parseInt(s.trim()));
    if (parts.length !== 2 || parts.some(isNaN)) return null;

    const [num, denom] = parts;
    if (num < 1 || num > 16) return null;
    if (![2, 4, 8, 16].includes(denom)) return null;

    return { numerator: num, denominator: denom };
  }

  function handleTimeDisplayClick() {
    if (clickTimer !== null) {
      // Second click within timeout → double-click → enter edit mode
      clearTimeout(clickTimer);
      clickTimer = null;
      enterTimeEditMode();
    } else {
      // First click → start timer, toggle format if no second click
      clickTimer = setTimeout(() => {
        clickTimer = null;
        transportStore.toggleTimeDisplayFormat();
      }, 225);
    }
  }

  function enterTimeEditMode() {
    editTimeValue = timeDisplay;
    isEditingTime = true;

    // Focus input after state update
    requestAnimationFrame(() => timeInputRef?.select());
  }

  function handleTimeEditComplete() {
    const parsed = parseTimeInput(editTimeValue, $transportStore.timeDisplayFormat, bpm);

    if (parsed !== null) {
      Transport.seek(parsed);
    }

    isEditingTime = false;
  }

  function handleTimeEditKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTimeEditComplete();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      isEditingTime = false;
    }
  }

  function parseTimeInput(
    input: string,
    format: TimeDisplayFormat,
    currentBpm: number
  ): number | null {
    return match(format)
      .with('seconds', () => {
        const val = parseFloat(input);

        return isNaN(val) ? null : Math.max(0, val);
      })
      .with('time', () => {
        // Parse MM:SS:CS (minutes:seconds:centiseconds)
        const parts = input.split(':').map(Number);
        if (parts.some(isNaN)) return null;

        const [m = 0, s = 0, cs = 0] = parts;

        return Math.max(0, m * 60 + s + cs / 100);
      })
      .with('bars', () => {
        // Parse bars:beats:sixteenths (0-indexed, matching clock scheduling API)
        const parts = input.split(':').map(Number);
        if (parts.some(isNaN)) return null;

        const [bars = 0, beats = 0, sixteenths = 0] = parts;

        // Each beat is (4/denominator) quarter notes long
        const quarterNotesPerBeat = 4 / denominator;
        const totalQuarterNotes =
          (bars * beatsPerBar + beats + sixteenths / 4) * quarterNotesPerBeat;

        return Math.max(0, totalQuarterNotes / (currentBpm / 60));
      })
      .exhaustive();
  }

  function toggleMute() {
    if (isMuted || volume === 0) {
      isMuted = false;
      volume = previousVolume === 0 ? 0.5 : previousVolume;

      audioService.setOutVolume(volume);
    } else {
      previousVolume = volume;
      isMuted = true;

      audioService.setOutVolume(0);
    }
  }

  function handleVolumeChange(newVolume: number) {
    volume = newVolume ?? 0;

    if (isMuted && volume > 0) {
      isMuted = false;
    }
  }

  async function toggleDsp() {
    isDspEnabled = !isDspEnabled;
    transportStore.setDspEnabled(isDspEnabled);

    if (isDspEnabled) {
      audioService.resumeDsp();
      await Transport.setDspEnabled(true);
    } else {
      audioService.suspendDsp();
      await Transport.setDspEnabled(false);
    }
  }

  // Update AudioService when volume changes (independent of DSP)
  $effect(() => {
    if (!isMuted) {
      audioService.setOutVolume(volume);
    }
  });

  // Sync BPM from store on mount and when store changes
  $effect(() => {
    const storeBpm = $transportStore.bpm;

    if (storeBpm !== bpm) {
      bpm = storeBpm;
      Transport.setBpm(storeBpm);
    }
  });

  // Sync time signature from store on mount and when store changes
  $effect(() => {
    const [storeBeatsPerBar, storeDenominator] = $transportStore.timeSignature;

    if (storeBeatsPerBar !== beatsPerBar || storeDenominator !== denominator) {
      beatsPerBar = storeBeatsPerBar;
      denominator = storeDenominator;

      Transport.setTimeSignature(storeBeatsPerBar, storeDenominator);
    }
  });

  onMount(() => {
    // Poll transport state at 30fps for UI
    const interval = setInterval(() => {
      isPlaying = Transport.isPlaying;
      seconds = Transport.seconds;
      beat = Transport.beat;
      bar = Transport.bar;
      phase = Transport.phase;
      bpm = Transport.bpm;
      beatsPerBar = Transport.beatsPerBar;
      denominator = Transport.denominator;
    }, 1000 / 30);

    // Sync volume from AudioService
    const volumeInterval = setInterval(() => {
      if (!isMuted) {
        volume = audioService.outVolume;
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(volumeInterval);
    };
  });
</script>

<div
  class="relative flex max-w-full flex-col gap-1 rounded-lg border border-zinc-700 bg-zinc-900/95 px-3 py-2 shadow-xl backdrop-blur-sm"
>
  <!-- Resize handle (left edge, desktop only) -->
  <div
    class="absolute top-0 -left-2 hidden h-full w-2 cursor-col-resize items-center justify-center opacity-0 transition-opacity hover:opacity-100 sm:flex"
    class:opacity-100={isResizing}
    onpointerdown={onResizePointerDown}
  >
    <div class="h-4 w-px bg-zinc-500"></div>
  </div>

  <div class="flex flex-wrap items-center gap-2">
    <!-- Play/Pause -->
    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          onclick={isPlaying ? handlePause : handlePlay}
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded bg-zinc-800 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!isDspEnabled}
        >
          {#if isPlaying}
            <Pause class="h-4 w-4 text-zinc-300" />
          {:else}
            <Play class="h-4 w-4 text-zinc-300" />
          {/if}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content>
        {#if !isDspEnabled}
          Enable DSP first
        {:else}
          {isPlaying ? 'Pause' : 'Play'} (Space)
        {/if}
      </Tooltip.Content>
    </Tooltip.Root>

    <!-- Stop -->
    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          onclick={handleStop}
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded bg-zinc-800 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!isDspEnabled}
        >
          <Square class="h-3.5 w-3.5 text-zinc-300" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content>
        {#if !isDspEnabled}
          Enable DSP first
        {:else}
          Stop
        {/if}
      </Tooltip.Content>
    </Tooltip.Root>

    <div class="hidden h-6 w-px bg-zinc-700 sm:block"></div>

    <!-- Time Display -->
    {#if isEditingTime}
      <input
        type="text"
        bind:this={timeInputRef}
        bind:value={editTimeValue}
        onblur={handleTimeEditComplete}
        onkeydown={handleTimeEditKeydown}
        class="w-[90px] rounded bg-zinc-800 px-2 py-1 text-center font-mono text-sm text-zinc-300 ring-1 ring-zinc-500 outline-none"
      />
    {:else}
      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            onclick={handleTimeDisplayClick}
            class="w-[90px] cursor-pointer rounded bg-zinc-800 px-2 py-1 font-mono text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            {timeDisplay}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content>Click to toggle format, double-click to edit</Tooltip.Content>
      </Tooltip.Root>
    {/if}

    <div class="hidden h-6 w-px bg-zinc-700 sm:block"></div>

    <!-- BPM -->
    <div class="flex items-center gap-1.5">
      <span class="text-xs text-zinc-500">BPM</span>

      <input
        type="number"
        value={bpm}
        onchange={handleBpmChange}
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        min="1"
        max="999"
        class="w-[46px] [appearance:textfield] rounded bg-zinc-800 px-2 py-1 text-center font-mono text-sm text-zinc-300 outline-none focus:ring-1 focus:ring-zinc-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        title="Beats per minute"
      />
    </div>

    <!-- Time Signature -->
    {#if isEditingTimeSig}
      <input
        type="text"
        bind:this={timeSigInputRef}
        bind:value={editTimeSigValue}
        onblur={handleTimeSigEditComplete}
        onkeydown={handleTimeSigKeydown}
        class="w-[46px] rounded bg-zinc-800 py-1 text-center font-mono text-sm text-zinc-300 ring-1 ring-zinc-500 outline-none"
      />
    {:else}
      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            onclick={enterTimeSigEditMode}
            class="w-[46px] cursor-pointer rounded bg-zinc-800 py-1 font-mono text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            {timeSigDisplay}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content>Time signature — click to edit</Tooltip.Content>
      </Tooltip.Root>
    {/if}

    <div class="hidden h-6 w-px bg-zinc-700 sm:block"></div>

    <!-- Volume -->
    <div class="flex items-center gap-2">
      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            onclick={toggleMute}
            class="flex h-8 w-8 cursor-pointer items-center justify-center rounded transition-colors hover:bg-zinc-700"
          >
            <!-- svelte-ignore svelte_component_deprecated -->
            <svelte:component
              this={volumeIcon}
              class="h-4 w-4 {isMuted || volume === 0 ? 'text-red-400' : 'text-zinc-300'}"
            />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content>{isMuted || volume === 0 ? 'Unmute' : 'Mute'}</Tooltip.Content>
      </Tooltip.Root>
      <Slider
        value={volume}
        onValueChange={handleVolumeChange}
        type="single"
        min={0}
        max={1}
        step={0.01}
        class="w-20 cursor-pointer"
      />
    </div>

    <div class="hidden h-6 w-px bg-zinc-700 sm:block"></div>

    <!-- DSP Toggle -->
    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          onclick={toggleDsp}
          class="cursor-pointer rounded px-2 py-1 text-xs font-medium transition-colors {isDspEnabled
            ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            : 'bg-red-900/50 text-red-400 hover:bg-red-900/70'}"
        >
          DSP
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content>
        {isDspEnabled ? 'DSP On - Click to disable' : 'DSP Off - Click to enable'}
      </Tooltip.Content>
    </Tooltip.Root>
  </div>

  <TimelineRuler width={rulerWidth} />
</div>
