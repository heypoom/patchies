<script lang="ts">
  import { AudioService } from '$lib/audio/v2/AudioService';
  import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip';
  import { Slider } from '$lib/components/ui/slider';
  import { VolumeX, Volume, Volume1, Volume2 } from '@lucide/svelte/icons';
  import { onMount } from 'svelte';

  const audioService = AudioService.getInstance();

  let isHovered = $state(false);
  let isMuted = $state(false);
  let volume = $state(0.8);
  let previousVolume = 0.8;

  // Update AudioService when volume changes
  $effect(() => {
    if (!isMuted) {
      audioService.setOutVolume(volume);
    }
  });

  function toggleMute() {
    if (isMuted) {
      // unmute
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
      // If user moves slider while muted, unmute
      isMuted = false;
    }
  }

  // Determine which icon to show
  const volumeIcon = $derived.by(() => {
    if (isMuted) return VolumeX;
    if (volume === 0) return VolumeX;
    if (volume < 0.33) return Volume;
    if (volume < 0.66) return Volume1;

    return Volume2;
  });

  onMount(() => {
    setInterval(() => {
      volume = audioService.outVolume;
    }, 1000);
  });
</script>

<Tooltip delayDuration={100}>
  <TooltipTrigger>
    {#snippet children()}
      <button
        title="Volume Control"
        class="flex cursor-pointer items-center justify-center rounded bg-zinc-900/70 p-2 transition-colors hover:bg-zinc-700"
        onclick={toggleMute}
        onmouseenter={() => (isHovered = true)}
        onmouseleave={() => (isHovered = false)}
      >
        <svelte:component
          this={volumeIcon}
          class="h-4 w-4 {isMuted || volume === 0 ? 'text-red-400' : 'text-zinc-300'}"
        />
      </button>
    {/snippet}
  </TooltipTrigger>

  <TooltipContent
    side="top"
    sideOffset={10}
    class="border-zinc-600 bg-transparent px-1 py-3"
    arrowClasses="hidden"
  >
    <div class="relative flex flex-col items-center space-y-2">
      <div class="absolute -top-6 w-8 text-center text-xs text-zinc-300">
        {Math.round(isMuted ? 0 : volume * 100)}%
      </div>

      <Slider
        value={volume}
        onValueChange={(nextVolume) => {
          handleVolumeChange(nextVolume);
        }}
        type="single"
        min={0}
        max={1}
        step={0.01}
        orientation="vertical"
        class="h-[50px]"
      />
    </div>
  </TooltipContent>
</Tooltip>
