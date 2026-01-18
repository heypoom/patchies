<script lang="ts">
	import { Loader, OctagonX, Pause, Play, SkipBack, Upload, Video } from '@lucide/svelte/icons';
	import { Handle, Position, NodeResizer, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { AudioService } from '$lib/audio/v2/AudioService';
	import { match, P } from 'ts-pattern';
	import { shouldShowHandles } from '../../../stores/ui.store';

	let {
		id: nodeId,
		data,
		selected,
		width: nodeWidth,
		height: nodeHeight
	}: {
		id: string;
		data: {
			fileName?: string;
			file?: File;
			width?: number;
			height?: number;
			url?: string;
			loop?: boolean;
		};
		selected: boolean;
		width?: number;
		height?: number;
	} = $props();

	let glSystem = GLSystem.getInstance();
	let messageContext: MessageContext;
	let audioService = AudioService.getInstance();
	const { updateNode } = useSvelteFlow();
	let videoElement = $state<HTMLVideoElement | undefined>();
	let isLoaded = $state(false);
	let isPaused = $state(true);
	let errorMessage = $state<string | null>(null);
	let bitmapFrameId: number;
	let isDragging = $state(false);
	let fileInputRef: HTMLInputElement;

	let resizerCanvas: OffscreenCanvas | null = null;
	let resizerCtx: OffscreenCanvasRenderingContext2D | null = null;

	const [defaultPreviewWidth, defaultPreviewHeight] = glSystem.previewSize;
	const [MAX_UPLOAD_WIDTH, MAX_UPLOAD_HEIGHT] = glSystem.outputSize;

	const hasFile = $derived(!!data.file || !!data.url);

	const handleMessage: MessageCallbackFn = (message) => {
		match(message)
			.with({ type: 'bang' }, () => restartVideo())
			.with({ type: 'pause' }, () => togglePause())
			.with({ type: 'loop', value: P.optional(P.boolean) }, ({ value }) => {
				const shouldLoop = value ?? true;
				updateNode(nodeId, { data: { loop: shouldLoop } });

				if (videoElement) {
					videoElement.loop = shouldLoop;
				}
			})
			.with(P.string, (url) => loadVideoFromUrl(url))
			.with({ type: 'load', url: P.string }, ({ url }) => loadVideoFromUrl(url))
			.otherwise(() => {});
	};

	async function loadVideoFromUrl(url: string) {
		try {
			const res = await fetch(url);
			const blob = await res.blob();

			const filename = getFileNameFromUrl(url);
			const file = new File([blob], filename, { type: blob.type });
			await loadFile(file, url);

			// Send URL to audio system as well
			audioService.send(nodeId, 'url', url);
		} catch (err) {
			console.error('Failed to load video from URL:', err);
			errorMessage = 'Failed to load video from URL';
		}
	}

	function getFileNameFromUrl(url: string): string {
		try {
			const urlObj = new URL(url);
			const pathname = urlObj.pathname;
			const filename = pathname.substring(pathname.lastIndexOf('/') + 1);

			if (filename && filename.includes('.')) {
				return decodeURIComponent(filename);
			}
		} catch (error) {
			// URL parsing failed, continue to fallback
		}

		return 'video.mp4';
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		isDragging = false;

		const files = event.dataTransfer?.files;
		if (!files || files.length === 0) return;

		const file = files[0];
		if (!file.type.startsWith('video/')) {
			console.warn('Only video files are supported');
			errorMessage = 'Only video files are supported';
			return;
		}

		loadFile(file);
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = input.files;
		if (!files || files.length === 0) return;

		const file = files[0];
		loadFile(file);
	}

	async function loadFile(file: File, url?: string) {
		try {
			console.log('Loading video file:', file.name, file.type, file.size);

			if (!videoElement) {
				console.error('Video element not available');
				errorMessage = 'Video element not ready';
				return;
			}

			const objectUrl = URL.createObjectURL(file);

			videoElement.onloadedmetadata = () => {
				if (videoElement) {
					const videoWidth = videoElement.videoWidth;
					const videoHeight = videoElement.videoHeight;

					// Scale down for preview while maintaining aspect ratio
					const aspectRatio = videoWidth / videoHeight;
					let previewWidth = defaultPreviewWidth;
					let previewHeight = defaultPreviewWidth / aspectRatio;

					if (previewHeight > defaultPreviewHeight) {
						previewHeight = defaultPreviewHeight;
						previewWidth = defaultPreviewHeight * aspectRatio;
					}

					updateNode(nodeId, {
						width: Math.round(previewWidth),
						height: Math.round(previewHeight),
						data: {
							file,
							fileName: file.name,
							width: videoWidth,
							height: videoHeight,
							url
						}
					});

					isLoaded = true;
					isPaused = true;
					errorMessage = null;

					audioService.send(nodeId, 'file', file);

					bitmapFrameId = requestAnimationFrame(uploadBitmap);
				}
			};

			videoElement.onerror = (e) => {
				console.error('Video loading error:', e);
				errorMessage = 'Failed to load video file';
				isLoaded = false;
			};

			videoElement.oncanplay = () => {
				console.log('Video can play');
			};

			videoElement.src = objectUrl;
			videoElement.load();
		} catch (error) {
			console.error('Failed to load video:', error);
			errorMessage = 'Failed to load video file';
			isLoaded = false;
		}
	}

	function restartVideo() {
		if (videoElement && isLoaded) {
			videoElement.currentTime = 0;

			// Send bang to audio system to restart audio (sets currentTime to 0 and plays)
			audioService.send(nodeId, 'message', { type: 'bang' });

			if (isPaused) {
				videoElement.play();
				isPaused = false;
			}
		}
	}

	function togglePause() {
		if (videoElement && isLoaded) {
			if (isPaused) {
				videoElement.play();
				audioService.send(nodeId, 'message', { type: 'play' });
				isPaused = false;
			} else {
				videoElement.pause();
				audioService.send(nodeId, 'message', { type: 'pause' });
				isPaused = true;
			}
		}
	}

	async function uploadBitmap() {
		const videoReady =
			videoElement && videoElement.readyState >= 2 && !videoElement.ended && !videoElement.error;

		if (
			videoElement &&
			videoReady &&
			isLoaded &&
			!isPaused &&
			glSystem.hasOutgoingVideoConnections(nodeId)
		) {
			const videoWidth = videoElement.videoWidth;
			const videoHeight = videoElement.videoHeight;

			// Check if we need to resize (if video is larger than our max dimensions)
			if (videoWidth > MAX_UPLOAD_WIDTH || videoHeight > MAX_UPLOAD_HEIGHT) {
				// Calculate scale to fit within max dimensions while preserving aspect ratio
				const scale = Math.min(MAX_UPLOAD_WIDTH / videoWidth, MAX_UPLOAD_HEIGHT / videoHeight);
				const scaledWidth = Math.round(videoWidth * scale);
				const scaledHeight = Math.round(videoHeight * scale);

				// Create or resize offscreen canvas if needed
				if (
					!resizerCanvas ||
					resizerCanvas.width !== scaledWidth ||
					resizerCanvas.height !== scaledHeight
				) {
					resizerCanvas = new OffscreenCanvas(scaledWidth, scaledHeight);
					resizerCtx = resizerCanvas.getContext('2d');
				}

				if (resizerCtx) {
					resizerCtx.drawImage(videoElement, 0, 0, scaledWidth, scaledHeight);

					// Create flipped ImageBitmap to match pipeline orientation
					const bitmap = await createImageBitmap(resizerCanvas, { imageOrientation: 'flipY' });
					await glSystem.setBitmap(nodeId, bitmap);
				}
			} else {
				// Video is already small enough, upload directly
				await glSystem.setBitmapSource(nodeId, videoElement);
			}
		}

		if (isLoaded) {
			bitmapFrameId = requestAnimationFrame(uploadBitmap);
		}
	}

	function openFileDialog() {
		fileInputRef?.click();
	}

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);
		glSystem.upsertNode(nodeId, 'img', {});

		// Create audio object for video
		audioService.createNode(nodeId, 'soundfile~', []);

		if (data.file) {
			loadFile(data.file, data.url);
			audioService.send(nodeId, 'file', data.file);
		} else if (data.url) {
			loadVideoFromUrl(data.url);
		}
	});

	onDestroy(() => {
		if (bitmapFrameId) {
			cancelAnimationFrame(bitmapFrameId);
		}

		messageContext?.queue.removeCallback(handleMessage);
		messageContext?.destroy();

		glSystem.removeNode(nodeId);

		audioService.removeNodeById(nodeId);
	});

	const handleCommonClass = $derived.by(() => {
		if (!selected && $shouldShowHandles) {
			return 'z-1 transition-opacity';
		}

		return `z-1 transition-opacity ${selected ? '' : 'sm:opacity-0 opacity-30 group-hover:opacity-100'}`;
	});
</script>

<div class="relative">
	<NodeResizer class="z-1" isVisible={selected} keepAspectRatio />

	{#if selected}
		<div class="absolute -top-7 z-10 w-fit rounded-lg bg-zinc-900 px-2 py-1">
			<div class="font-mono text-xs font-medium text-zinc-400">video</div>
		</div>
	{/if}

	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div></div>
				<div class="flex gap-1">
					{#if isLoaded}
						<button
							title={isPaused ? 'Play video' : 'Pause video'}
							class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
							onclick={togglePause}
						>
							<svelte:component this={isPaused ? Play : Pause} class="h-4 w-4 text-zinc-300" />
						</button>
						<button
							title="Restart video"
							class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
							onclick={restartVideo}
						>
							<SkipBack class="h-4 w-4 text-zinc-300" />
						</button>
						<button
							title="Change video"
							class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
							onclick={openFileDialog}
						>
							<Upload class="h-4 w-4 text-zinc-300" />
						</button>
					{/if}
				</div>
			</div>

			<div class="relative">
				<StandardHandle
					port="inlet"
					type="message"
					class={handleCommonClass}
					total={1}
					index={0}
					{nodeId}
				/>

				<div
					class={`rounded-lg border-1 ${selected ? 'shadow-glow-md border-zinc-400 bg-zinc-800' : 'hover:shadow-glow-sm border-transparent'}`}
				>
					{#if !errorMessage}
						<video
							bind:this={videoElement}
							class="rounded-lg object-cover {hasFile && isLoaded ? '' : 'hidden'}"
							style="width: {nodeWidth || defaultPreviewWidth}px; height: {nodeHeight ||
								defaultPreviewHeight}px"
							muted
							loop={data.loop ?? true}
						></video>
					{/if}

					{#if (hasFile && !isLoaded) || errorMessage}
						<div
							class="flex flex-col items-center justify-center gap-2 rounded-lg border-1 px-1 py-3
							{isDragging ? 'border-blue-400 bg-blue-50/10' : 'border-dashed border-zinc-600 bg-zinc-900'}"
							style="width: {defaultPreviewWidth}px; height: {defaultPreviewHeight}px"
						>
							<svelte:component
								this={errorMessage ? OctagonX : Loader}
								class={[
									'h-8 w-8 text-zinc-400',
									!errorMessage ? 'animate-spin' : 'text-red-400'
								].join(' ')}
							/>

							<div class="px-2 text-center font-mono text-[12px] font-light text-zinc-400">
								{#if errorMessage}
									<div class="text-xs text-red-400">{errorMessage}</div>
								{:else}
									<div>loading video file...</div>
								{/if}
							</div>
						</div>
					{/if}

					{#if !hasFile}
						<div
							class="flex flex-col items-center justify-center gap-2 rounded-lg border-1 px-1 py-3
							{isDragging ? 'border-blue-400 bg-blue-50/10' : 'border-dashed border-zinc-600 bg-zinc-900'}"
							style="width: {defaultPreviewWidth}px; height: {defaultPreviewHeight}px"
							ondragover={handleDragOver}
							ondragleave={handleDragLeave}
							ondrop={handleDrop}
							ondblclick={openFileDialog}
							role="button"
							tabindex="0"
							onkeydown={(e) => e.key === 'Enter' && openFileDialog()}
						>
							<Video class="h-8 w-8 text-zinc-400" />
							<div class="px-2 text-center font-mono text-[12px] font-light text-zinc-400">
								<span class="text-zinc-300">double click</span> or
								<span class="text-zinc-300">drop</span><br />
								video file
							</div>
							{#if errorMessage}
								<div class="text-xs text-red-400">{errorMessage}</div>
							{/if}
						</div>
					{/if}
				</div>

				<StandardHandle
					port="outlet"
					type="video"
					id="0"
					title="Video output"
					total={2}
					index={0}
					class={handleCommonClass}
					{nodeId}
				/>

				<StandardHandle
					port="outlet"
					type="audio"
					title="Audio output"
					total={2}
					index={1}
					class={handleCommonClass}
					{nodeId}
				/>
			</div>
		</div>
	</div>
</div>

<!-- Hidden file input -->
<input
	bind:this={fileInputRef}
	type="file"
	accept="video/*"
	onchange={handleFileSelect}
	class="hidden"
/>
