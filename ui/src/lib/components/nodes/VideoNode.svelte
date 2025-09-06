<script lang="ts">
	import { Handle, Position, NodeResizer, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { AudioSystem } from '$lib/audio/AudioSystem';
	import { getPortPosition } from '$lib/utils/node-utils';
	import { match, P } from 'ts-pattern';

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
	let audioSystem = AudioSystem.getInstance();
	const { updateNode } = useSvelteFlow();
	let videoElement = $state<HTMLVideoElement | undefined>();
	let isLoaded = $state(false);
	let isPaused = $state(true);
	let errorMessage = $state<string | null>(null);
	let bitmapFrameId: number;
	let isDragging = $state(false);
	let fileInputRef: HTMLInputElement;

	const [defaultPreviewWidth, defaultPreviewHeight] = glSystem.previewSize;

	const hasFile = $derived(!!data.file || !!data.url);

	const handleMessage: MessageCallbackFn = (message) => {
		match(message)
			.with({ type: 'bang' }, () => restartVideo())
			.with({ type: 'pause' }, () => togglePause())
			.with({ type: 'loop', value: P.optional(P.boolean) }, ({ value }) => {
				const shouldLoop = value ?? true;
				updateNode(nodeId, { data: { ...data, loop: shouldLoop } });

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
			audioSystem.send(nodeId, 'url', url);
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
			console.log('Created object URL:', objectUrl);

			videoElement.onloadedmetadata = () => {
				console.log('Video metadata loaded');
				if (videoElement) {
					const videoWidth = videoElement.videoWidth;
					const videoHeight = videoElement.videoHeight;

					console.log('Video dimensions:', videoWidth, 'x', videoHeight);

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
							...data,
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

					// Send the file to the audio system
					audioSystem.send(nodeId, 'file', file);

					// Start upload loop
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
			audioSystem.send(nodeId, 'message', { type: 'bang' });

			if (isPaused) {
				videoElement.play();
				isPaused = false;
			} else {
				// If video was already playing, pause audio since bang auto-plays it
				audioSystem.send(nodeId, 'message', { type: 'pause' });
			}
		}
	}

	function togglePause() {
		if (videoElement && isLoaded) {
			if (isPaused) {
				videoElement.play();
				audioSystem.send(nodeId, 'message', { type: 'play' });
				isPaused = false;
			} else {
				videoElement.pause();
				audioSystem.send(nodeId, 'message', { type: 'pause' });
				isPaused = true;
			}
		}
	}

	async function uploadBitmap() {
		if (videoElement && isLoaded && !isPaused && glSystem.hasOutgoingVideoConnections(nodeId)) {
			try {
				// Check if video element is in a valid state
				if (videoElement.readyState >= 2 && !videoElement.ended && !videoElement.error) {
					await glSystem.setBitmapSource(nodeId, videoElement);
				}
			} catch (error) {
				console.warn('Failed to upload video bitmap:', error);
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
		audioSystem.createAudioObject(nodeId, 'soundfile~', []);

		if (data.file) {
			loadFile(data.file, data.url);
			audioSystem.send(nodeId, 'file', data.file);
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
		audioSystem.removeAudioObject(nodeId);
	});

	const handleCommonClass = $derived.by(() => {
		return `z-1 ${selected ? '' : 'opacity-40'}`;
	});
</script>

<div class="relative">
	<NodeResizer class="z-1" isVisible={selected} keepAspectRatio />

	{#if selected}
		<div class="absolute -top-7 z-10 w-fit rounded-lg bg-zinc-900/60 px-2 py-1 backdrop-blur-lg">
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
							class="rounded p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
							onclick={togglePause}
						>
							<Icon
								icon={isPaused ? 'lucide:play' : 'lucide:pause'}
								class="h-4 w-4 text-zinc-300"
							/>
						</button>
						<button
							title="Restart video"
							class="rounded p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
							onclick={restartVideo}
						>
							<Icon icon="lucide:skip-back" class="h-4 w-4 text-zinc-300" />
						</button>
						<button
							title="Change video"
							class="rounded p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
							onclick={openFileDialog}
						>
							<Icon icon="lucide:upload" class="h-4 w-4 text-zinc-300" />
						</button>
					{/if}
				</div>
			</div>

			<div class="relative">
				<Handle type="target" position={Position.Top} class={handleCommonClass} />

				<div
					class={`border-1 rounded-lg ${selected ? 'border-zinc-400 bg-zinc-800' : 'border-zinc-700 bg-zinc-900'}`}
				>
					<video
						bind:this={videoElement}
						class="rounded-lg object-cover {hasFile && isLoaded ? '' : 'hidden'}"
						style="width: {nodeWidth || defaultPreviewWidth}px; height: {nodeHeight ||
							defaultPreviewHeight}px"
						muted
						loop={data.loop ?? true}
					></video>
					{#if !hasFile || !isLoaded}
						<div
							class="border-1 flex flex-col items-center justify-center gap-2 rounded-lg px-1 py-3
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
							<Icon icon="lucide:video" class="h-8 w-8 text-zinc-400" />
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

				<VideoHandle
					type="source"
					position={Position.Bottom}
					id="video-out"
					title="Video output"
					class="z-1 absolute {selected ? '' : 'opacity-40'}"
					style={`left: ${getPortPosition(2, 0)}`}
				/>

				<Handle
					type="source"
					position={Position.Bottom}
					class="z-1 absolute !bg-blue-500 {selected ? '' : 'opacity-40'}"
					id="audio-out"
					title="Audio output"
					style={`left: ${getPortPosition(2, 1)}`}
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
