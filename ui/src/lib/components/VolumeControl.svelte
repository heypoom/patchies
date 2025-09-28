<script lang="ts">
	import { AudioSystem } from '$lib/audio/AudioSystem';
	import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip';
	import { Slider } from '$lib/components/ui/slider';
	import Icon from '@iconify/svelte';

	const audioSystem = AudioSystem.getInstance();

	let isHovered = $state(false);
	let isMuted = $state(false);
	let volume = $state(0.8);
	let previousVolume = 0.8;

	// Sync with AudioSystem volume on component mount
	$effect(() => {
		volume = audioSystem.outVolume;
	});

	// Update AudioSystem when volume changes
	$effect(() => {
		if (!isMuted) {
			audioSystem.setOutVolume(volume);
		}
	});

	function toggleMute() {
		if (isMuted) {
			// unmute
			isMuted = false;

			volume = previousVolume === 0 ? 0.5 : previousVolume;

			audioSystem.setOutVolume(volume);
		} else {
			previousVolume = volume;
			isMuted = true;
			audioSystem.setOutVolume(0);
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
		if (isMuted) return 'lucide:volume-x';
		if (volume === 0) return 'lucide:volume-x';
		if (volume < 0.33) return 'lucide:volume';
		if (volume < 0.66) return 'lucide:volume-1';

		return 'lucide:volume-2';
	});
</script>

<Tooltip delayDuration={100}>
	<TooltipTrigger>
		{#snippet children()}
			<button
				title="Volume Control"
				class="flex h-6 w-6 cursor-pointer items-center justify-center rounded bg-zinc-900/70 transition-colors hover:bg-zinc-700"
				onclick={toggleMute}
				onmouseenter={() => (isHovered = true)}
				onmouseleave={() => (isHovered = false)}
			>
				<Icon icon={volumeIcon} class="h-4 w-4 text-zinc-300 {isMuted ? 'text-red-400' : ''}" />
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
