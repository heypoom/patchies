<script lang="ts">
	import { Settings, X, Video, Info, ExternalLink } from '@lucide/svelte/icons';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { useSvelteFlow } from '@xyflow/svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import { match, P } from 'ts-pattern';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import { AudioService } from '$lib/audio/v2/AudioService';
	import type { VdoNinjaNode } from '$lib/audio/v2/nodes/VdoNinjaNode';
	import { loadVdoNinjaSdk, createVdoNinjaInstance, type VDONinjaSDK } from '$lib/vdo-ninja/sdk';

	export type VdoNinjaPullNodeData = {
		room?: string;
		viewStreamID?: string;
		dataOnly?: boolean;
	};

	type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

	// Sanitize input to only allow alphanumeric characters
	const sanitizeId = (value: string) => value.replace(/[^a-zA-Z0-9]/g, '');

	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: VdoNinjaPullNodeData;
		selected: boolean;
	} = $props();

	const { updateNodeData } = useSvelteFlow();

	let showSettings = $state(false);
	let connectionStatus = $state<ConnectionStatus>('disconnected');
	let errorMessage = $state('');

	// VDO.Ninja state
	let vdo: VDONinjaSDK | null = $state(null);
	let sdkLoaded = $state(false);

	// Local state
	let room = $state(data.room ?? '');
	let viewStreamID = $state(data.viewStreamID ?? '');
	let dataOnly = $state(data.dataOnly ?? false);

	// Message context
	let messageContext: MessageContext;

	// Video/Audio output
	let glSystem = GLSystem.getInstance();
	let audioService = AudioService.getInstance();
	let videoElement: HTMLVideoElement | null = null;
	let remoteStream: MediaStream | null = null;
	let bitmapFrameId: number | null = null;
	let vdoAudioNode: VdoNinjaNode | null = null;

	// Track received streams
	let hasVideoTrack = $state(false);
	let hasAudioTrack = $state(false);

	const containerClass = $derived.by(() => {
		const baseClass = selected ? 'object-container-selected' : 'object-container';
		const statusClass = match(connectionStatus)
			.with('connected', () => 'border-green-500')
			.with('error', () => 'border-red-500')
			.with('connecting', () => 'border-yellow-500')
			.otherwise(() => '');
		return [baseClass, statusClass];
	});

	const statusDot = $derived.by(() =>
		match(connectionStatus)
			.with('connected', () => 'bg-green-500')
			.with('error', () => 'bg-red-500')
			.with('connecting', () => 'bg-yellow-500 animate-pulse')
			.otherwise(() => 'bg-zinc-500')
	);

	onMount(async () => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);

		// Register with GL system for video output
		glSystem.upsertNode(nodeId, 'img', {});

		// Create hidden video element for receiving remote video
		videoElement = document.createElement('video');
		videoElement.autoplay = true;
		videoElement.muted = true; // Mute video element - audio goes through Web Audio API
		videoElement.playsInline = true;

		// Create audio node for VDO.Ninja audio output
		vdoAudioNode = (await audioService.createNode(nodeId, 'vdo.ninja~', [])) as VdoNinjaNode | null;

		// Load VDO.Ninja SDK
		try {
			await loadVdoNinjaSdk();
			sdkLoaded = true;
		} catch (err) {
			connectionStatus = 'error';
			errorMessage = 'Failed to load VDO.Ninja SDK';
			messageContext.send({ type: 'error', message: errorMessage });
		}
	});

	onDestroy(() => {
		disconnect();

		if (bitmapFrameId !== null) {
			cancelAnimationFrame(bitmapFrameId);
		}

		glSystem.removeNode(nodeId);
		audioService.removeNodeById(nodeId);

		if (messageContext) {
			messageContext.queue.removeCallback(handleMessage);
			messageContext.destroy();
		}
	});

	function handleConnectedEvent() {
		connectionStatus = 'connected';
		messageContext.send({ type: 'connected', room });
	}

	function handleErrorEvent(event: CustomEvent) {
		connectionStatus = 'error';
		errorMessage = event.detail?.error?.message ?? 'Connection error';
		messageContext.send({ type: 'error', message: errorMessage });
	}

	function handleDataEvent(event: CustomEvent) {
		const { data: receivedData, uuid } = event.detail;

		messageContext.send({ type: 'data', data: receivedData, uuid });
	}

	function handleTrackEvent(event: CustomEvent) {
		const { track, streams, uuid, streamID } = event.detail;

		// Only handle tracks from our target stream
		if (viewStreamID && streamID !== viewStreamID) {
			return;
		}

		messageContext.send({
			type: 'track',
			kind: track.kind,
			uuid,
			streamID
		});

		// Create or get remote stream
		if (!remoteStream) {
			remoteStream = new MediaStream();
		}

		// Add track to our stream
		remoteStream.addTrack(track);

		if (track.kind === 'video') {
			hasVideoTrack = true;

			// Attach to video element
			if (videoElement) {
				videoElement.srcObject = remoteStream;
				videoElement.play().catch(console.error);

				// Start frame upload loop
				if (bitmapFrameId === null) {
					bitmapFrameId = requestAnimationFrame(uploadBitmap);
				}
			}
		} else if (track.kind === 'audio') {
			hasAudioTrack = true;

			// Connect audio track to our VDO.Ninja audio node
			if (vdoAudioNode) {
				vdoAudioNode.addAudioTrack(track);
			}
		}
	}

	async function connect() {
		if (!sdkLoaded || !room) return;

		disconnect();
		connectionStatus = 'connecting';
		errorMessage = '';

		try {
			vdo = createVdoNinjaInstance();

			// Set up event listeners
			vdo.addEventListener('connected', handleConnectedEvent);
			vdo.addEventListener('data', handleDataEvent);
			vdo.addEventListener('dataReceived', handleDataEvent);
			vdo.addEventListener('track', handleTrackEvent);
			vdo.addEventListener('error', handleErrorEvent);

			if (dataOnly) {
				// Use autoConnect for data-only mode - simpler mesh networking
				await vdo.autoConnect(room);
			} else {
				await vdo.connect();
				await vdo.joinRoom({ room });

				// If we have a stream ID to view, request it
				if (viewStreamID) {
					await viewStream(viewStreamID);
				}
			}

			// Save to node data
			updateNodeData(nodeId, { room, viewStreamID, dataOnly });
		} catch (err) {
			connectionStatus = 'error';
			errorMessage = err instanceof Error ? err.message : 'Connection failed';
			messageContext.send({ type: 'error', message: errorMessage });
		}
	}

	async function viewStream(streamID: string) {
		if (!vdo || connectionStatus !== 'connected') return;

		try {
			// Always establish connection to enable data channel
			// In data only mode, we still connect but won't receive media tracks
			// (since the push node won't be publishing any)
			await vdo.view(streamID, { audio: true, video: true });
			messageContext.send({ type: 'viewing', streamID, dataOnly });
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : 'Failed to view stream';
			errorMessage = errMsg;
			messageContext.send({ type: 'error', message: errMsg });
		}
	}

	function disconnect() {
		const wasConnected = connectionStatus === 'connected';

		// Stop frame upload
		if (bitmapFrameId !== null) {
			cancelAnimationFrame(bitmapFrameId);
			bitmapFrameId = null;
		}

		// Clear audio source on the VDO.Ninja audio node
		if (vdoAudioNode) {
			vdoAudioNode.setMediaStream(null);
		}

		// Stop remote stream tracks
		if (remoteStream) {
			remoteStream.getTracks().forEach((track) => track.stop());
			remoteStream = null;
		}

		// Clear video element
		if (videoElement) {
			videoElement.srcObject = null;
		}

		hasVideoTrack = false;
		hasAudioTrack = false;

		if (vdo) {
			vdo.removeEventListener('connected', handleConnectedEvent);
			vdo.removeEventListener('data', handleDataEvent);
			vdo.removeEventListener('dataReceived', handleDataEvent);
			vdo.removeEventListener('track', handleTrackEvent);
			vdo.removeEventListener('error', handleErrorEvent);
			vdo.disconnect();
			vdo = null;
		}

		connectionStatus = 'disconnected';
		if (wasConnected) {
			messageContext.send({ type: 'disconnected' });
		}
	}

	async function uploadBitmap() {
		if (
			videoElement &&
			hasVideoTrack &&
			videoElement.readyState >= 2 &&
			glSystem.hasOutgoingVideoConnections(nodeId)
		) {
			await glSystem.setBitmapSource(nodeId, videoElement);
		}

		if (hasVideoTrack && connectionStatus === 'connected') {
			bitmapFrameId = requestAnimationFrame(uploadBitmap);
		}
	}

	function handleMessage(msg: unknown) {
		if (!isObjectMessage(msg)) return;

		match(msg)
			.with({ type: 'connect', room: P.string, viewStreamID: P.optional(P.string) }, (m) => {
				room = m.room;
				viewStreamID = m.viewStreamID ?? viewStreamID;
				connect();
			})
			.with({ type: 'view', streamID: P.string }, (m) => {
				viewStreamID = m.streamID;
				viewStream(m.streamID);
			})
			.with({ type: 'disconnect' }, () => {
				disconnect();
			})
			.otherwise(() => {});
	}

	function isObjectMessage(data: unknown): data is { type: string; [key: string]: unknown } {
		return typeof data === 'object' && data !== null && 'type' in data;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			if (document.activeElement?.getAttribute('data-room-input')) {
				connect();
			} else {
				showSettings = false;
			}
		} else if (e.key === 'Escape') {
			showSettings = false;
		}
	}
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div></div>
				<div>
					<button
						class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
						onclick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							showSettings = !showSettings;
						}}
						title="Configure VDO.Ninja Pull"
					>
						<Settings class="h-4 w-4 text-zinc-300" />
					</button>
				</div>
			</div>

			<div class="relative">
				<!-- Message Inlet -->
				<StandardHandle
					port="inlet"
					type="message"
					id="0"
					title="connect, view, disconnect, send"
					total={1}
					index={0}
					class="top-0"
					{nodeId}
				/>

				<button
					class={['cursor-pointer rounded-lg border px-3 py-2', containerClass]}
					title={errorMessage || `VDO.Ninja Pull ${connectionStatus}`}
				>
					<div class="flex items-center justify-center gap-2">
						<div class="relative">
							<Video class="h-4 w-4 text-zinc-500" />
						</div>
						<div class="font-mono text-xs text-zinc-300">vdo.ninja.pull</div>
					</div>
				</button>

				<!-- Message Outlet -->
				<StandardHandle
					port="outlet"
					type="message"
					id="0"
					title="data from peers"
					total={3}
					index={0}
					class="bottom-0"
					{nodeId}
				/>

				<!-- Video Outlet -->
				<div class={dataOnly ? 'opacity-30' : ''}>
					<StandardHandle
						port="outlet"
						type="video"
						id="0"
						title={dataOnly ? 'disabled (data only mode)' : 'video stream'}
						total={3}
						index={1}
						{nodeId}
					/>
				</div>

				<!-- Audio Outlet -->
				<div class={dataOnly ? 'opacity-30' : ''}>
					<StandardHandle
						port="outlet"
						type="audio"
						id="0"
						title={dataOnly ? 'disabled (data only mode)' : 'audio stream'}
						total={3}
						index={2}
						{nodeId}
					/>
				</div>
			</div>
		</div>
	</div>

	{#if showSettings}
		<div class="absolute left-38">
			<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
				<button onclick={() => (showSettings = false)} class="rounded p-1 hover:bg-zinc-700">
					<X class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="nodrag ml-2 w-64 rounded-lg border border-zinc-600 bg-zinc-900 p-3 shadow-xl"
				onkeydown={handleKeydown}
			>
				<div class="space-y-3">
					<!-- Connection Status -->
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<div class={['h-2 w-2 rounded-full', statusDot]}></div>
							<span class="text-xs text-zinc-400">
								{match(connectionStatus)
									.with('connected', () => `Connected to ${room}`)
									.with('connecting', () => 'Connecting...')
									.with('error', () => errorMessage || 'Error')
									.otherwise(() => 'Disconnected')}
							</span>
						</div>

						<!-- Message API hint -->
						<div class="group/info relative">
							<Info class="h-3 w-3 cursor-help text-zinc-500 hover:text-zinc-300" />
							<div
								class="pointer-events-none absolute top-5 right-0 z-50 hidden w-56 rounded border border-zinc-600 bg-zinc-800 p-2 text-[9px] shadow-lg group-hover/info:block"
							>
								<div class="mb-1.5 font-semibold text-zinc-300">Inlet Messages</div>
								<div class="space-y-1 text-zinc-400">
									<div><span class="text-green-400">connect</span> {`{room, viewStreamID?}`}</div>
									<div><span class="text-green-400">view</span> {`{streamID: '...'}`}</div>
									<div><span class="text-green-400">disconnect</span></div>
								</div>
								<div class="mt-2 mb-1.5 font-semibold text-zinc-300">Outlet Messages</div>
								<div class="space-y-1 text-zinc-400">
									<div><span class="text-blue-400">connected</span> {`{room}`}</div>
									<div><span class="text-blue-400">disconnected</span></div>
									<div><span class="text-blue-400">viewing</span> {`{streamID}`}</div>
									<div><span class="text-blue-400">track</span> {`{kind, uuid, streamID}`}</div>
									<div><span class="text-blue-400">data</span> {`{data, uuid}`}</div>
									<div><span class="text-blue-400">error</span> {`{message}`}</div>
								</div>
							</div>
						</div>
					</div>

					<!-- Room Name -->
					<div>
						<div class="mb-1 flex items-center justify-between">
							<span class="text-[8px] text-zinc-400">Room Name</span>
							<button
								onclick={() => room && window.open(`https://vdo.ninja/?room=${room}`, '_blank')}
								disabled={!room}
								class="flex items-center gap-1 rounded bg-zinc-700 px-1.5 py-0.5 text-[8px] text-zinc-300 hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
								title="View room in VDO.Ninja"
							>
								<ExternalLink class="h-2.5 w-2.5" />
								View
							</button>
						</div>
						<input
							type="text"
							bind:value={room}
							oninput={(e) => (room = sanitizeId(e.currentTarget.value))}
							data-room-input="true"
							placeholder="myroomname"
							class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-400 focus:outline-none"
						/>
					</div>

					<!-- Stream ID to View -->
					<div>
						<div class="mb-1 flex items-center justify-between">
							<span class="text-[8px] text-zinc-400">Stream ID to View</span>
							<button
								onclick={() =>
									viewStreamID && window.open(`https://vdo.ninja/?pull=${viewStreamID}`, '_blank')}
								disabled={!viewStreamID}
								class="flex items-center gap-1 rounded bg-zinc-700 px-1.5 py-0.5 text-[8px] text-zinc-300 hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
								title="View stream in VDO.Ninja"
							>
								<ExternalLink class="h-2.5 w-2.5" />
								View
							</button>
						</div>
						<input
							type="text"
							bind:value={viewStreamID}
							oninput={(e) => (viewStreamID = sanitizeId(e.currentTarget.value))}
							placeholder="mystreamid"
							class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-400 focus:outline-none"
						/>
					</div>

					<!-- Data Only Toggle -->
					<div class="flex items-center justify-between">
						<div>
							<span class="text-[10px] text-zinc-300">Data Only</span>
							<div class="text-[8px] text-zinc-500">Disable video/audio receiving</div>
						</div>
						<button
							aria-label="Toggle data only mode"
							onclick={() => {
								dataOnly = !dataOnly;
								updateNodeData(nodeId, { dataOnly });
							}}
							class={[
								'relative h-5 w-9 rounded-full transition-colors',
								dataOnly ? 'bg-green-600' : 'bg-zinc-600'
							]}
						>
							<div
								class={[
									'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
									dataOnly ? 'translate-x-4' : 'translate-x-0.5'
								]}
							></div>
						</button>
					</div>

					<!-- Receiving Status -->
					{#if connectionStatus === 'connected' && !dataOnly}
						<div class="rounded bg-zinc-800 p-2 text-[10px] text-zinc-400">
							<div class="font-medium text-zinc-300">Receiving:</div>
							<div class="mt-1 flex gap-2">
								<div class="flex items-center gap-1">
									<div
										class={[
											'h-1.5 w-1.5 rounded-full',
											hasVideoTrack ? 'bg-orange-500' : 'bg-zinc-600'
										]}
									></div>
									<span>Video</span>
								</div>
								<div class="flex items-center gap-1">
									<div
										class={[
											'h-1.5 w-1.5 rounded-full',
											hasAudioTrack ? 'bg-blue-500' : 'bg-zinc-600'
										]}
									></div>
									<span>Audio</span>
								</div>
							</div>
						</div>
					{/if}

					<!-- Connect/Disconnect button -->
					<div>
						{#if connectionStatus === 'connected'}
							<button
								onclick={disconnect}
								class="w-full rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-500"
							>
								Disconnect
							</button>
						{:else}
							<button
								onclick={connect}
								disabled={!room || !sdkLoaded || connectionStatus === 'connecting'}
								class="w-full rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{#if !sdkLoaded}
									Loading SDK...
								{:else if connectionStatus === 'connecting'}
									Connecting...
								{:else}
									Connect
								{/if}
							</button>
						{/if}
					</div>

					<!-- View Stream button (when connected but not viewing) -->
					{#if connectionStatus === 'connected' && viewStreamID && !hasVideoTrack && !hasAudioTrack}
						<button
							onclick={() => viewStream(viewStreamID)}
							class="w-full rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500"
						>
							View Stream
						</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
