<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';

	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: { width?: number; height?: number };
		selected: boolean;
	} = $props();

	let glSystem = GLSystem.getInstance();
	let messageContext: MessageContext;
	const { updateNodeData } = useSvelteFlow();
	let videoElement = $state<HTMLVideoElement | undefined>();
	let isCapturing = $state(false);
	let isPaused = $state(false);
	let errorMessage = $state<string | null>(null);
	let bitmapFrameId: number;

	const handleMessage: MessageCallbackFn = (message) => {
		match(message)
			.with({ type: 'bang' }, () => startCapture())
			.with({ type: 'pause' }, () => togglePause())
			.with({ type: 'size', width: P.number, height: P.number }, ({ width, height }) => {
				updateNodeData(nodeId, { ...data, width, height });
			})
			.otherwise(() => {});
	};

	async function startCapture() {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: {
					width: { ideal: data.width || 640 },
					height: { ideal: data.height || 480 }
				},
				audio: false
			});

			if (videoElement) {
				videoElement.srcObject = stream;
				await videoElement.play();
				isCapturing = true;
				errorMessage = null;

				// Start uploading frames
				bitmapFrameId = requestAnimationFrame(uploadBitmap);

				// Handle stream ending
				stream.getVideoTracks()[0].onended = () => {
					stopCapture();
				};
			}
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to access webcam';
			isCapturing = false;
		}
	}

	async function stopCapture() {
		if (videoElement?.srcObject) {
			const stream = videoElement.srcObject as MediaStream;
			stream.getTracks().forEach((track) => track.stop());
			videoElement.srcObject = null;
		}

		isCapturing = false;
		if (bitmapFrameId) {
			cancelAnimationFrame(bitmapFrameId);
		}
	}

	function togglePause() {
		if (!isCapturing) return;

		isPaused = !isPaused;
		if (videoElement) {
			if (isPaused) {
				videoElement.pause();
			} else {
				videoElement.play();
			}
		}
	}

	async function uploadBitmap() {
		if (videoElement && isCapturing && !isPaused && glSystem.hasOutgoingVideoConnections(nodeId)) {
			await glSystem.setBitmapSource(nodeId, videoElement);
		}

		if (isCapturing) {
			bitmapFrameId = requestAnimationFrame(uploadBitmap);
		}
	}

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);
		glSystem.upsertNode(nodeId, 'img', {});
	});

	onDestroy(() => {
		stopCapture();
		glSystem.removeNode(nodeId);
		messageContext?.queue.removeCallback(handleMessage);
		messageContext?.destroy();
	});

	const handleCommonClass = $derived.by(() => {
		return `z-1 ${selected ? '' : 'opacity-40'}`;
	});
</script>

<div class="relative">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div></div>
				<div class="flex gap-1">
					{#if isCapturing}
						<button
							title={isPaused ? 'Resume webcam' : 'Pause webcam'}
							class="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700"
							onclick={togglePause}
						>
							<Icon
								icon={isPaused ? 'lucide:play' : 'lucide:pause'}
								class="h-4 w-4 text-zinc-300"
							/>
						</button>
						<button
							title="Stop webcam"
							class="rounded p-1 opacity-100 transition-opacity hover:bg-zinc-700"
							onclick={stopCapture}
						>
							<Icon icon="lucide:square" class="h-4 w-4 text-red-500" />
						</button>
					{:else}
						<button
							title="Start webcam"
							class="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700"
							onclick={startCapture}
						>
							<Icon icon="lucide:play" class="h-4 w-4 text-zinc-300" />
						</button>
					{/if}
				</div>
			</div>

			<div class="relative">
				<Handle type="target" position={Position.Top} class={handleCommonClass} />

				<div
					class={`rounded-lg border-1 ${selected ? 'border-zinc-400 bg-zinc-800' : 'border-zinc-700 bg-zinc-900'}`}
				>
					<video
						bind:this={videoElement}
						class="h-32 w-48 rounded object-cover {isCapturing ? '' : 'hidden'}"
						muted
						autoplay
						playsinline
					></video>
					{#if !isCapturing}
						<div class="flex h-32 w-48 items-center justify-center">
							<div class="flex flex-col items-center gap-2">
								<Icon icon="lucide:camera" class="h-8 w-8 text-zinc-400" />
								<div class="text-xs text-zinc-400">Webcam</div>
								{#if errorMessage}
									<div class="text-xs text-red-400">{errorMessage}</div>
								{/if}
							</div>
						</div>
					{/if}
				</div>

				<VideoHandle
					type="source"
					position={Position.Bottom}
					id="video-out"
					title="Video output"
					class={handleCommonClass}
				/>
			</div>
		</div>
	</div>
</div>
