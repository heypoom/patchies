<script lang="ts">
	import { Camera, Pause, Play, Square } from '@lucide/svelte/icons';
	import { useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { PREVIEW_SCALE_FACTOR } from '$lib/canvas/constants';

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

	const [defaultOutputWidth, defaultOutputHeight] = glSystem.outputSize;
	const [defaultPreviewWidth, defaultPreviewHeight] = glSystem.previewSize;

	const handleMessage: MessageCallbackFn = (message) => {
		match(message)
			.with({ type: 'bang' }, () => startCapture())
			.with({ type: 'pause' }, () => togglePause())
			.with({ type: 'size', width: P.number, height: P.number }, ({ width, height }) => {
				updateNodeData(nodeId, { width, height });
			})
			.otherwise(() => {});
	};

	async function startCapture() {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: {
					width: { ideal: data.width ?? defaultOutputWidth },
					height: { ideal: data.height ?? defaultOutputHeight }
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
			glSystem.setBitmapSource(nodeId, videoElement);
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

	const canvasWidth = $derived(
		data.width ? data.width / PREVIEW_SCALE_FACTOR : defaultPreviewWidth
	);

	const canvasHeight = $derived(
		data.height ? data.height / PREVIEW_SCALE_FACTOR : defaultPreviewHeight
	);
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
							class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
							onclick={togglePause}
						>
							<svelte:component this={isPaused ? Play : Pause} class="h-4 w-4 text-zinc-300" />
						</button>
						<button
							title="Stop webcam"
							class="rounded p-1 opacity-100 transition-opacity hover:bg-zinc-700"
							onclick={stopCapture}
						>
							<Square class="h-4 w-4 text-red-500" />
						</button>
					{:else}
						<button
							title="Start webcam"
							class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
							onclick={startCapture}
						>
							<Play class="h-4 w-4 text-zinc-300" />
						</button>
					{/if}
				</div>
			</div>

			<div class="relative">
				<StandardHandle port="inlet" type="message" total={1} index={0} class={handleCommonClass} />

				<div
					class={`rounded-lg border-1 ${selected ? 'object-container-selected' : 'object-container'}`}
				>
					<video
						bind:this={videoElement}
						class="rounded object-cover {isCapturing ? '' : 'hidden'}"
						muted
						autoplay
						playsinline
						width={data.width ?? defaultOutputWidth}
						height={data.height ?? defaultOutputHeight}
						style={`width: ${canvasWidth}px; height: ${canvasHeight}px;`}
					></video>

					{#if !isCapturing}
						<div class="flex h-32 w-48 items-center justify-center">
							<div class="flex flex-col items-center gap-2">
								<Camera class="h-8 w-8 text-zinc-400" />

								{#if errorMessage}
									<div class="text-xs text-red-400">{errorMessage}</div>
								{/if}
							</div>
						</div>
					{/if}
				</div>

				<StandardHandle
					port="outlet"
					type="video"
					id="0"
					title="Video output"
					total={1}
					index={0}
					class={handleCommonClass}
				/>
			</div>
		</div>
	</div>
</div>
