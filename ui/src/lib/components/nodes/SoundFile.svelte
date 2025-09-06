<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { AudioSystem } from '$lib/audio/AudioSystem';
	import { getFileNameFromUrl } from '$lib/utils/sound-url';

	let node: {
		id: string;
		data: {
			fileName?: string;
			file?: File;
			url?: string;
		};
		selected: boolean;
	} = $props();

	const { updateNodeData } = useSvelteFlow();

	let messageContext: MessageContext;
	let audioSystem = AudioSystem.getInstance();
	let isDragging = $state(false);
	let fileInputRef: HTMLInputElement;

	const fileName = $derived(node.data.fileName || 'No file selected');
	const hasFile = $derived(!!node.data.file || !!node.data.url);

	const handleMessage: MessageCallbackFn = async (message) => {
		match(message)
			.with(P.string, (url) => setUrl(url))
			.with({ type: 'load', url: P.string }, ({ url }) => setUrl(url))
			.with({ type: 'read' }, () => readAudioBuffer())
			.otherwise(() => audioSystem.send(node.id, 'message', message));
	};

	function setUrl(url: string) {
		const fileName = getFileNameFromUrl(url);

		updateNodeData(node.id, { ...node.data, fileName, url });
		audioSystem.send(node.id, 'url', url);
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
		audioSystem.send(node.id, 'file', file);
	}

	function openFileDialog() {
		fileInputRef?.click();
	}

	async function readAudioBuffer() {
		if (!hasFile) {
			console.warn('No file loaded to read');
			return;
		}

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

			const audioBuffer = await audioSystem.audioContext.decodeAudioData(buffer);
			messageContext.send(audioBuffer);
		} catch {}
	}

	function playFile() {
		if (!hasFile) return;

		audioSystem.send(node.id, 'message', { type: 'bang' });
	}

	function stopFile() {
		if (hasFile) {
			audioSystem.send(node.id, 'message', { type: 'stop' });
		}
	}

	onMount(() => {
		messageContext = new MessageContext(node.id);
		messageContext.queue.addCallback(handleMessage);

		audioSystem.createAudioObject(node.id, 'soundfile~', []);

		if (node.data.file) {
			audioSystem.send(node.id, 'file', node.data.file);
		}

		if (node.data.url) setUrl(node.data.url);
	});

	onDestroy(() => {
		messageContext?.queue.removeCallback(handleMessage);
		messageContext?.destroy();
		audioSystem.removeAudioObject(node.id);
	});

	const containerClass = $derived.by(() => {
		if (isDragging) return 'border-blue-400 bg-blue-50/10';
		if (node.selected) return 'border-zinc-400 bg-zinc-800';
		if (hasFile) return 'border-zinc-700 bg-zinc-900';

		return 'border-dashed border-zinc-600 bg-zinc-900';
	});
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div></div>

				{#if hasFile}
					<div class="flex gap-1">
						<button
							title="Play"
							class="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700"
							onclick={playFile}
						>
							<Icon icon="lucide:play" class="h-4 w-4 text-zinc-300" />
						</button>

						<button
							title="Stop"
							class="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700"
							onclick={stopFile}
						>
							<Icon icon="lucide:square" class="h-4 w-4 text-zinc-300" />
						</button>
					</div>
				{/if}
			</div>

			<div class="relative">
				<Handle type="target" position={Position.Top} />

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
							<Icon icon="lucide:volume-2" class="h-4 w-4 text-zinc-500" />

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
							<Icon icon="lucide:upload" class="h-3 w-3 text-zinc-400" />

							<div class="font-mono text-[12px] font-light text-zinc-400">
								<span class="text-zinc-300">double click</span> or
								<span class="text-zinc-300">drop</span>
								sound file
							</div>
						</div>
					{/if}
				</div>

				<Handle type="source" position={Position.Bottom} class="!bg-blue-500" id="audio-out" />
			</div>
		</div>
	</div>
</div>

<!-- Hidden file input -->
<input
	bind:this={fileInputRef}
	type="file"
	accept="audio/*"
	onchange={handleFileSelect}
	class="hidden"
/>
