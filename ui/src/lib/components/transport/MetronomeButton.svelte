<script lang="ts">
  import { Transport } from '$lib/transport';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { Metronome } from '@lucide/svelte/icons';
  import { onMount } from 'svelte';

  let { bpm }: { bpm: number } = $props();

  // --- Menu ---
  let showMenu = $state(false);

  // --- Tap Tempo ---
  let tapTimes = $state<number[]>([]);
  let tapResetTimer: ReturnType<typeof setTimeout> | null = null;
  let tapFlash = $state(false);

  const tapBpm = $derived.by(() => {
    if (tapTimes.length < 2) return null;
    const intervals = tapTimes.slice(1).map((t, i) => t - tapTimes[i]);
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return Math.round(60000 / avg);
  });

  function handleTapTempo() {
    const now = Date.now();

    if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > 2000) {
      tapTimes = [];
    }

    tapTimes.push(now);
    if (tapTimes.length > 8) tapTimes = tapTimes.slice(-8);

    if (tapBpm !== null && tapBpm >= 20 && tapBpm <= 999) {
      Transport.setBpm(tapBpm);
    }

    tapFlash = true;
    setTimeout(() => (tapFlash = false), 80);

    if (tapResetTimer) clearTimeout(tapResetTimer);
    tapResetTimer = setTimeout(() => {
      tapTimes = [];
      tapResetTimer = null;
    }, 2000);
  }

  // --- Metronome Sounds ---
  let metronomeEnabled = $state(false);
  let audioCtx: AudioContext | null = null;
  let lastBeat = -1;

  function playClick(accent: boolean) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = accent ? 1000 : 700;
    gain.gain.setValueAtTime(accent ? 0.5 : 0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.04);
  }

  function toggleMetronome() {
    metronomeEnabled = !metronomeEnabled;
    if (metronomeEnabled) {
      audioCtx = new AudioContext();
      lastBeat = -1;
    } else if (audioCtx) {
      audioCtx.close();
      audioCtx = null;
    }
  }

  onMount(() => {
    const interval = setInterval(() => {
      if (!metronomeEnabled || !audioCtx) return;
      const isPlaying = Transport.isPlaying;
      if (!isPlaying) {
        lastBeat = -1;
        return;
      }
      const currentBeat = Transport.beat;
      if (currentBeat !== lastBeat) {
        lastBeat = currentBeat;
        playClick(currentBeat === 0);
      }
    }, 1000 / 60);

    return () => clearInterval(interval);
  });
</script>

<div class="relative">
  <Tooltip.Root>
    <Tooltip.Trigger>
      <button
        onclick={() => (showMenu = !showMenu)}
        class="flex h-8 w-8 cursor-pointer items-center justify-center rounded transition-colors {tapFlash
          ? 'bg-zinc-500 text-zinc-100'
          : showMenu
            ? 'bg-zinc-700 text-zinc-200'
            : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}"
        aria-label="Metronome"
      >
        <Metronome class="h-4 w-4" />
      </button>
    </Tooltip.Trigger>

    <Tooltip.Content>Tap tempo / Metronome</Tooltip.Content>
  </Tooltip.Root>

  {#if showMenu}
    <div class="fixed inset-0 z-10" onclick={() => (showMenu = false)} role="none"></div>

    <div
      class="absolute bottom-full left-0 z-20 mb-4 w-44 rounded-lg border border-zinc-700 bg-zinc-900 p-2 shadow-xl"
    >
      <!-- Tap area -->
      <button
        onclick={handleTapTempo}
        class="w-full cursor-pointer rounded p-3 text-center transition-colors {tapFlash
          ? 'bg-zinc-500'
          : 'bg-zinc-800 hover:bg-zinc-700'}"
      >
        <div class="text-xs text-zinc-400">TAP TEMPO</div>
        <div class="mt-0.5 font-mono text-sm font-medium text-zinc-200">
          {#if tapTimes.length === 0}
            {bpm} BPM
          {:else if tapTimes.length === 1}
            keep tapping…
          {:else}
            {tapBpm} BPM
          {/if}
        </div>
      </button>

      <div class="mt-2 border-t border-zinc-700 pt-2">
        <button
          onclick={toggleMetronome}
          class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-zinc-800 {metronomeEnabled
            ? 'text-zinc-200'
            : 'text-zinc-400'}"
        >
          <div
            class="h-3 w-3 rounded-full border transition-colors {metronomeEnabled
              ? 'border-green-400 bg-green-400'
              : 'border-zinc-600'}"
          ></div>
          <span>Click sounds</span>
        </button>
      </div>
    </div>
  {/if}
</div>
