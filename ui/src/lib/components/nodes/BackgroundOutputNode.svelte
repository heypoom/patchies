<script lang="ts">
	import { ScreenShare } from '@lucide/svelte/icons';
	import { Position } from '@xyflow/svelte';

	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { isBackgroundOutputCanvasEnabled } from '../../../stores/canvas.store';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import { onDestroy, onMount } from 'svelte';

	// Get node data from XY Flow - nodes receive their data as props
	let { id: nodeId, selected }: { id: string; selected: boolean } = $props();
	let glSystem = GLSystem.getInstance();

	const borderClass = $derived.by(() => {
		if ($isBackgroundOutputCanvasEnabled) return '';
		if (selected) return 'border border-zinc-400';
		return 'border border-zinc-800';
	});

	onMount(() => {
		glSystem.upsertNode(nodeId, 'bg.out', {});
	});

	onDestroy(() => {
		glSystem.removeNode(nodeId);
	});
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-zinc-900/50 px-2 py-1">
					<div class="font-mono text-xs font-medium text-zinc-400">bg.out</div>
				</div>
			</div>

			<div class="relative">
				<StandardHandle port="inlet" type="video" id="0" title="Video output" total={1} index={0} />

				<div
					class={[
						'flex h-[60px] w-[60px] items-center justify-center rounded-lg bg-zinc-900/50 backdrop-blur-xl',
						borderClass
					]}
				>
					<ScreenShare class="h-5 w-5 text-zinc-500" />
				</div>
			</div>
		</div>
	</div>
</div>
