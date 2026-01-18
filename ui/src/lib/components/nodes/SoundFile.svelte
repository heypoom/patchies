<script lang="ts">
	import { Mic, Play, Square, Upload, Volume2 } from '@lucide/svelte/icons';
	import { useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { MessageSystem } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { AudioService } from '$lib/audio/v2/AudioService';
	import type { SoundfileNode as SoundfileNodeV2 } from '$lib/audio/v2/nodes/SoundfileNode';
	import { getFileNameFromUrl } from '$lib/utils/sound-url';
	import { logger } from '$lib/utils/logger';
	import { getObjectType } from '$lib/objects/get-type';
	import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
	import * as ContextMenu from '$lib/components/ui/context-menu';

	let node: {
		id: string;
		data: {
			fileName?: string;
			file?: File;
			url?: string;
		};
		selected: boolean;
	} = $props();

	const { updateNodeData, getEdges } = useSvelteFlow();

	let messageContext: MessageContext;
	let audioService = AudioService.getInstance();
	let messageSystem = MessageSystem.getInstance();
	let v2Node: SoundfileNodeV2 | null = null;
	let isDragging = $state(false);
	let fileInputRef: HTMLInputElement;

	const fileName = $derived(node.data.fileName || 'No file selected');
	const hasFile = $derived(!!node.data.file || !!node.data.url);

	const handleMessage: MessageCallbackFn = async (message) => {
		match(message)
			.with(P.string, (url) => setUrl(url))
			.with({ type: 'load', url: P.string }, ({ url }) => setUrl(url))
			.with({ type: 'read' }, () => readAudioBuffer())
			.otherwise(() => audioService.send(node.id, 'message', message));
	};

	function setUrl(url: string) {
		const fileName = getFileNameFromUrl(url);

		updateNodeData(node.id, { ...node.data, fileName, url });
		audioService.send(node.id, 'url', url);

		autoReadIfConnectedToConvolver();
	}

	/**
	 * Check if this soundfile~ is already connected to a convolver~'s buffer inlet,
	 * and if so, automatically read and send the audio buffer.
	 *
	 * TODO: there is a bug where if you connect an already loaded sound file
	 *       into a convolver~, it will NOT work.
	 */
	function autoReadIfConnectedToConvolver() {
		if (!hasFile) return;

		// Get all edges where this node is the source
		const connectedEdges = messageSystem.getConnectedEdgesToTargetInlet(node.id);

		// Check if any edge connects to a convolver~'s buffer inlet
		for (const { targetNodeId, inletKey } of connectedEdges) {
			const target = audioService.getNodeById(targetNodeId);
			if (!target || getObjectType(target) !== 'convolver~') continue;

			const inlet = audioService.getInletByHandle(targetNodeId, inletKey ?? null);

			if (inlet?.name === 'buffer') {
				readAudioBuffer();
				logger.debug('reading soundfile~ into buffer of convolver~');
			}
		}
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
		if (!file.type.startsWith('audio/')) {
			console.warn('Only audio files are supported');
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

	function loadFile(file: File) {
		updateNodeData(node.id, {
			...node.data,
			file,
			fileName: file.name
		});

		// Send the file to the audio system
		audioService.send(node.id, 'file', file);

		autoReadIfConnectedToConvolver();
	}

	function openFileDialog() {
		fileInputRef?.click();
	}

	async function readAudioBuffer() {
		if (!hasFile) return;

		try {
			let buffer: ArrayBuffer;

			if (node.data.file) {
				buffer = await node.data.file.arrayBuffer();
			} else if (node.data.url) {
				const response = await fetch(node.data.url);
				buffer = await response.arrayBuffer();
			} else {
				return;
			}

			const audioBuffer = await audioService.getAudioContext().decodeAudioData(buffer);
			messageContext.send(audioBuffer);
		} catch {}
	}

	function playFile() {
		if (!hasFile) return;

		audioService.send(node.id, 'message', { type: 'bang' });
	}

	function stopFile() {
		if (hasFile) {
			audioService.send(node.id, 'message', { type: 'stop' });
		}
	}

	onMount(() => {
		messageContext = new MessageContext(node.id);
		messageContext.queue.addCallback(handleMessage);

		audioService.createNode(node.id, 'soundfile~', []);

		// Get the V2 node reference from AudioService
		v2Node = audioService.getNodeById(node.id) as SoundfileNodeV2;

		if (node.data.file) {
			audioService.send(node.id, 'file', node.data.file);
		}

		if (node.data.url) setUrl(node.data.url);
	});

	onDestroy(() => {
		messageContext?.queue.removeCallback(handleMessage);
		messageContext?.destroy();
		audioService.removeNodeById(node.id);
	});

	const containerClass = $derived.by(() => {
		if (isDragging) return 'border-blue-400 bg-blue-50/10';
		if (node.selected) return 'border-zinc-400 bg-zinc-800';
		if (hasFile) return 'border-zinc-700 bg-zinc-900';

		return 'border-dashed border-zinc-600 bg-zinc-900';
	});

	/**
	 * Convert this soundfile~ node to a sampler~ node, preserving the audio file.
	 * The sampler~ will load the same audio file with additional features like
	 * recording, loop points, playback rate, and detune controls.
	 */
	async function convertToSampler() {
		if (!hasFile) return;

		const eventBus = PatchiesEventBus.getInstance();

		// Prepare the audio buffer for the sampler
		let audioBuffer: AudioBuffer | null = null;

		try {
			let buffer: ArrayBuffer;

			if (node.data.file) {
				buffer = await node.data.file.arrayBuffer();
			} else if (node.data.url) {
				const response = await fetch(node.data.url);
				buffer = await response.arrayBuffer();
			} else {
				return;
			}

			audioBuffer = await audioService.getAudioContext().decodeAudioData(buffer);
		} catch (err) {
			logger.error('Failed to decode audio for sampler conversion:', err);
			return;
		}

		// Dispatch node replace event with sampler data
		// Handle mapping: soundfile~ uses "audio-out-0", sampler~ uses "audio-out-audio-out"
		// Also map inlet: soundfile~ uses "message-in", sampler~ has "audio-in-audio-in" and "message-in-message-in"
		eventBus.dispatch({
			type: 'nodeReplace',
			nodeId: node.id,
			newType: 'sampler~',
			newData: {
				hasRecording: true,
				duration: audioBuffer.duration,
				loopStart: 0,
				loopEnd: audioBuffer.duration,
				loop: false,
				playbackRate: 1,
				detune: 0,
				// Store the file or URL so sampler can load it
				_audioFile: node.data.file,
				_audioUrl: node.data.url
			},
			handleMapping: {
				// Outlet: soundfile~ audio-out-0 -> sampler~ audio-out-audio-out
				'audio-out-0': 'audio-out-audio-out',

				// Inlet: soundfile~ message-in -> sampler~ message-in-message-in
				'message-in': 'message-in-message-in'
			}
		});
	}
</script>

<ContextMenu.Root>
	<ContextMenu.Trigger>
		<div class="relative flex gap-x-3">
			<div class="group relative">
				<div class="flex flex-col gap-2">
					<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
						<div></div>

						{#if hasFile}
							<div class="flex gap-1">
								<button
									title="Play"
									class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
									onclick={playFile}
								>
									<Play class="h-4 w-4 text-zinc-300" />
								</button>

								<button
									title="Stop"
									class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
									onclick={stopFile}
								>
									<Square class="h-4 w-4 text-zinc-300" />
								</button>
							</div>
						{/if}
					</div>

					<div class="relative">
						<StandardHandle port="inlet" type="message" total={1} index={0} nodeId={node.id} />

						<div
							class={[
								'flex flex-col items-center justify-center gap-3 rounded-lg border-1',
								containerClass
							]}
							ondragover={handleDragOver}
							ondragleave={handleDragLeave}
							ondrop={handleDrop}
							role="figure"
						>
							{#if hasFile}
								<div
									class="flex items-center justify-center gap-2 px-3 py-[7px]"
									ondblclick={openFileDialog}
									role="figure"
								>
									<Volume2 class="h-4 w-4 text-zinc-500" />

									<div class="text-center font-mono">
										<div class="max-w-[150px] truncate text-[12px] font-light text-zinc-300">
											{fileName}
										</div>
									</div>
								</div>
							{:else}
								<div
									class="flex items-center justify-center gap-2 px-3 py-[7px]"
									ondblclick={openFileDialog}
									role="figure"
								>
									<Upload class="h-3 w-3 text-zinc-400" />

									<div class="font-mono text-[12px] font-light text-zinc-400">
										<span class="text-zinc-300">double click</span> or
										<span class="text-zinc-300">drop</span>
										sound file
									</div>
								</div>
							{/if}
						</div>

						<StandardHandle
							port="outlet"
							type="audio"
							id="0"
							title="Audio output"
							total={1}
							index={0}
							nodeId={node.id}
						/>
					</div>
				</div>
			</div>
		</div>
	</ContextMenu.Trigger>

	<ContextMenu.Content>
		{#if hasFile}
			<ContextMenu.Item onclick={convertToSampler}>
				<Mic class="mr-2 h-4 w-4" />
				Convert to Sampler
			</ContextMenu.Item>
		{/if}
	</ContextMenu.Content>
</ContextMenu.Root>

<!-- Hidden file input -->
<input
	bind:this={fileInputRef}
	type="file"
	accept="audio/*"
	onchange={handleFileSelect}
	class="hidden"
/>
