<script lang="ts">
	import { Position } from '@xyflow/svelte';

	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import { VideoSystem } from '$lib/video/VideoSystem';
	import Icon from '@iconify/svelte';
	import { onDestroy, onMount } from 'svelte';
	import { isBackgroundOutputCanvasEnabled } from '../../../stores/canvas.store';

	// Get node data from XY Flow - nodes receive their data as props
	let { id: nodeId, selected }: { id: string; selected: boolean } = $props();

	let videoSystem: VideoSystem;

	onMount(() => {
		videoSystem = VideoSystem.getInstance();

		videoSystem.onVideoCanvas(nodeId, (canvases) => {
			if (canvases?.[0]) {
				videoSystem.outputNodeCanvas = canvases?.[0];
				videoSystem.outputNodeId = nodeId;
				$isBackgroundOutputCanvasEnabled = true;
			} else {
				videoSystem.outputNodeCanvas = null;
				videoSystem.outputNodeId = null;
				$isBackgroundOutputCanvasEnabled = false;
			}
		});
	});

	onDestroy(() => {
		videoSystem.unregisterNode(nodeId);

		$isBackgroundOutputCanvasEnabled = false;

		if (videoSystem.outputNodeId === nodeId) {
			videoSystem.outputNodeId = null;
			videoSystem.outputNodeCanvas = null;

			if (videoSystem.outputNodeId) {
				videoSystem.unregisterNode(videoSystem.outputNodeId);
			}
		}
	});

	const borderClass = $derived.by(() => {
		if ($isBackgroundOutputCanvasEnabled) return '';
		if (selected) return 'border border-zinc-400';
		return 'border border-zinc-800';
	});
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-zinc-900/50 px-2 py-1">
					<div class="font-mono text-xs font-medium text-zinc-100">bg.out</div>
				</div>
			</div>

			<div class="relative">
				<VideoHandle
					type="target"
					position={Position.Top}
					id="video-out"
					title="Video output"
					class="z-1"
				/>

				<div
					class={[
						'flex h-[100px] w-[100px] items-center justify-center rounded-lg bg-zinc-900/50 backdrop-blur-xl',
						borderClass
					]}
				>
					<Icon icon="lucide:screen-share" class="h-8 w-8 text-zinc-500" />
				</div>
			</div>
		</div>
	</div>
</div>
