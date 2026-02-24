<script lang="ts">
  import { Transport } from '$lib/transport';
  import { transportStore, type TimeDisplayFormat } from '../../../stores/transport.store';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import { Slider } from '$lib/components/ui/slider';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { Play, Pause, Square, Volume2, VolumeX, Volume, Volume1 } from '@lucide/svelte/icons';
  import { onMount } from 'svelte';
  import { match } from 'ts-pattern';

  const audioService = AudioService.getInstance();

  // Transport state (updated via polling)
  let isPlaying = $state(false);
  let seconds = $state(0);
  let beat = $state(0);
  let bpm = $state(120);

  // Volume state (independent of DSP)
  let volume = $state(0.8);
  let isMuted = $state(false);
  let previousVolume = 0.8;

  // DSP state (independent of volume/mute)
  let isDspEnabled = $state(true);

  // Format time display
  const timeDisplay = $derived.by(() => {
    return match($transportStore.timeDisplayFormat)
      .with('seconds', () => formatSeconds(seconds))
      .with('bars', () => formatBars(seconds, bpm))
      .with('time', () => formatTime(seconds))
      .exhaustive();
  });

  const formatSeconds = (secs: number): string => `${secs.toFixed(2).padStart(8, '0')}`;

  function formatTime(secs: number): string {
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);

    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function formatBars(secs: number, bpm: number): string {
    const beatsPerSecond = bpm / 60;
    const totalBeats = secs * beatsPerSecond;
    const bars = Math.floor(totalBeats / 4) + 1;
    const beatInBar = Math.floor(totalBeats % 4) + 1;
    const sixteenths = Math.floor((totalBeats % 1) * 4) + 1;

    // Zero-pad bars to 3 digits to prevent layout shifts (e.g., 001:1:01)
    return `${bars.toString().padStart(3, '0')}:${beatInBar}:${sixteenths.toString().padStart(2, '0')}`;
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

  function toggleTimeFormat() {
    transportStore.toggleTimeDisplayFormat();
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

  onMount(() => {
    // Poll transport state at 30fps for UI
    const interval = setInterval(() => {
      isPlaying = Transport.isPlaying;
      seconds = Transport.seconds;
      beat = Transport.beat;
      bpm = Transport.bpm;
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
  class="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/95 px-3 py-2 shadow-xl backdrop-blur-sm"
>
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

  <div class="h-6 w-px bg-zinc-700"></div>

  <!-- Time Display -->
  <Tooltip.Root>
    <Tooltip.Trigger>
      <button
        onclick={toggleTimeFormat}
        class="min-w-[80px] cursor-pointer rounded bg-zinc-800 px-2 py-1 font-mono text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
      >
        {timeDisplay}
      </button>
    </Tooltip.Trigger>
    <Tooltip.Content>Click to toggle format</Tooltip.Content>
  </Tooltip.Root>

  <div class="h-6 w-px bg-zinc-700"></div>

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
      class="w-17 rounded bg-zinc-800 px-2 py-1 text-center font-mono text-sm text-zinc-300 outline-none focus:ring-1 focus:ring-zinc-600"
    />
  </div>

  <div class="h-6 w-px bg-zinc-700"></div>

  <!-- Volume -->
  <div class="flex items-center gap-2">
    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          onclick={toggleMute}
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded transition-colors hover:bg-zinc-700"
        >
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

  <div class="h-6 w-px bg-zinc-700"></div>

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
