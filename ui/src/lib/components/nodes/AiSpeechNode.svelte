<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { Message } from '$lib/messages/MessageSystem';
	import { match } from 'ts-pattern';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import Slider from '$lib/components/ui/slider/slider.svelte';
	import { voicesStore, fetchVoices } from '$lib/stores/voices';

	let {
		id: nodeId,
		data
	}: {
		id: string;
		data: {
			text: string;
			emotionVoice?: string;
			language?: string;
			speed?: number;
			volume?: number;
			pitch?: number;
			voiceId?: string;
		};
	} = $props();

	let messageContext: MessageContext;
	let errorMessage = $state<string | null>(null);
	let playbackState = $state<'loading' | 'playing' | 'paused'>('paused');
	let audio = $state<HTMLAudioElement | null>(null);
	let cachedAudioUrl = $state<string | null>(null);
	let audioTextHash = $state<string>('');
	const { updateNodeData } = useSvelteFlow();

	onMount(() => {
		messageContext = new MessageContext(nodeId);

		const context = messageContext.getContext();

		context.onMessage((message: Message) => {
			const { data } = message;

			match(data.type).with('speech', () => {
				const newData = {
					...data,
					...(data.text && { text: data.text }),
					...(data.emotionVoice && { emotionVoice: data.emotionVoice }),
					...(data.language && { language: data.language }),
					...(data.speed !== undefined && { speed: data.speed }),
					...(data.volume !== undefined && { volume: data.volume }),
					...(data.pitch !== undefined && { pitch: data.pitch }),
					...(data.voiceId && { voiceId: data.voiceId })
				};

				updateNodeData(nodeId, newData);
				generateSpeech();
			});
		});

		// Fetch voices if not already cached
		fetchVoices();

		return () => {};
	});

	onDestroy(() => {
		if (messageContext) {
			messageContext.destroy();
		}
		if (audio) {
			audio.pause();
			audio = null;
		}
	});

	const getPlayIcon = () => (playbackState === 'playing' ? 'lucide:pause' : 'lucide:play');

	function getPlayTitle() {
		switch (playbackState) {
			case 'playing':
				return 'Pause';
			case 'loading':
				return 'Loading...';
			default:
				return 'Play';
		}
	}

	function createTextHash(text: string, settings: object): string {
		return btoa(JSON.stringify({ text, ...settings }));
	}

	function togglePlayback() {
		if (!cachedAudioUrl) return;

		match(playbackState)
			.with('playing', () => {
				if (audio) {
					audio.pause();
					playbackState = 'paused';
				}
			})
			.with('paused', () => {
				if (cachedAudioUrl) {
					playAudio(cachedAudioUrl);
				}
			})
			.otherwise(() => {});
	}

	function handleGenerate() {
		generateSpeech();
	}

	function playAudio(url: string) {
		if (audio) {
			audio.pause();
		}

		audio = new Audio(url);
		audio.onplay = () => {
			playbackState = 'playing';
		};
		audio.onpause = () => {
			playbackState = 'paused';
		};
		audio.onended = () => {
			playbackState = 'paused';
		};
		audio.onerror = () => {
			errorMessage = 'Error playing audio';
			playbackState = 'paused';
		};

		audio.play().catch((error) => {
			errorMessage = 'Failed to play audio: ' + error.message;
			playbackState = 'paused';
		});
	}

	async function generateSpeech() {
		const apiKey = localStorage.getItem('celestiai-api-key');

		if (!apiKey) {
			errorMessage = 'API key not found. Please set your CelestiAI API key.';
			return;
		}

		if (!data.text.trim()) {
			errorMessage = 'Please enter text to generate speech.';
			return;
		}

		playbackState = 'loading';
		errorMessage = null;

		try {
			const body = {
				text: data.text,
				emotionVoice: data.emotionVoice || 'Cheerful_Female',
				language: data.language || 'th',
				speed: data.speed ?? 1,
				volume: data.volume ?? 1,
				pitch: data.pitch ?? 1
				// voiceId: data.voiceId || $voicesStore.data?.rvcModels?.[0]?.id || ''
			};

			const response = await fetch('https://api.celestiai.co/api/v1/tts-turbo/tts-mita', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${apiKey}`
				},
				body: JSON.stringify(body)
			});

			const json = await response.json();

			if (json.success) {
				// Cache the audio URL and text hash
				cachedAudioUrl = json.fileUrl;
				audioTextHash = createTextHash(data.text, body);

				// Play the audio
				playAudio(json.fileUrl);
			} else {
				errorMessage = json.message || 'Speech generation failed';
				playbackState = 'paused';
			}
		} catch (error) {
			errorMessage = 'Network error: ' + error.message;
			playbackState = 'paused';
		}
	}
</script>

<div class="group relative font-mono">
	<div class="flex flex-col gap-2">
		<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
			<div class="z-10 rounded-lg bg-transparent px-2 py-1">
				<div class="font-mono text-xs font-medium text-zinc-100">ai.speech</div>
			</div>

			<div class="flex gap-1">
				<!-- Generate Button -->
				<button
					class="rounded p-1 transition-all hover:bg-zinc-700 disabled:opacity-50"
					onclick={handleGenerate}
					disabled={playbackState === 'loading'}
					title="Generate Speech"
				>
					<Icon
						icon={playbackState === 'loading' ? 'lucide:loader' : 'lucide:sparkles'}
						class={['h-4 w-4 text-zinc-300', playbackState === 'loading' ? 'animate-spin' : '']}
					/>
				</button>

				<!-- Play Button (only show if audio is available) -->
				{#if cachedAudioUrl}
					<button
						class="rounded p-1 transition-all hover:bg-zinc-700 disabled:opacity-50"
						onclick={togglePlayback}
						disabled={playbackState === 'loading'}
						title={getPlayTitle()}
					>
						<Icon icon={getPlayIcon()} class="h-4 w-4 text-zinc-300" />
					</button>
				{/if}
			</div>
		</div>

		<div class="relative">
			<Handle type="target" position={Position.Top} class="z-1" />

			<div class="w-80 rounded-lg border border-zinc-600 bg-zinc-900 p-4">
				<!-- Main Text Input -->
				<div class="nodrag mb-4">
					<textarea
						value={data.text}
						placeholder="Enter text to read..."
						class="h-20 w-full resize-none rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
						onchange={(e) => {
							updateNodeData(nodeId, { ...data, text: e.currentTarget.value });
						}}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								generateSpeech();
							}
						}}
					></textarea>
				</div>

				<!-- Settings Section -->
				<div class="space-y-3">
					<!-- Voice Selection -->
					<div class="nodrag">
						<label class="mb-1 block text-[10px] font-medium text-zinc-400">emotion voice</label>

						<Select
							value={[data.emotionVoice || 'Cheerful_Female']}
							onValueChange={(value) => {
								const emotionVoice = Array.isArray(value) ? value.at(-1) : value;

								updateNodeData(nodeId, { ...data, emotionVoice });
							}}
						>
							<SelectTrigger
								class="!h-[30px] w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-[10px] text-zinc-100 focus:border-zinc-500 focus:outline-none"
							>
								{data.emotionVoice || 'Cheerful_Female'}
							</SelectTrigger>
							<SelectContent class="max-h-60 border-zinc-600 bg-zinc-800">
								{#if $voicesStore.loading}
									<SelectItem value="" class="text-[10px] text-zinc-400" disabled
										>Loading voices...</SelectItem
									>
								{:else if $voicesStore.error}
									<SelectItem value="" class="text-[10px] text-red-400" disabled
										>Error loading voices</SelectItem
									>
								{:else if $voicesStore.data?.emotionVoices?.available}
									{#each $voicesStore.data.emotionVoices.available as voice}
										<SelectItem value={voice} class="text-[10px] text-zinc-100 hover:bg-zinc-700">
											{voice}
										</SelectItem>
									{/each}
								{:else}
									<SelectItem
										value="Cheerful_Female"
										class="text-[10px] text-zinc-100 hover:bg-zinc-700"
									>
										Cheerful_Female
									</SelectItem>
								{/if}
							</SelectContent>
						</Select>
					</div>

					<!-- Language -->
					<div class="nodrag">
						<label class="mb-1 block text-[10px] font-medium text-zinc-400">language</label>
						<input
							type="text"
							value={data.language || 'th'}
							placeholder="Language code (e.g., th, en)"
							class="h-7 w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-[10px] text-zinc-100 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
							onchange={(e) => {
								updateNodeData(nodeId, { ...data, language: e.currentTarget.value });
							}}
						/>
					</div>

					<!-- RVC Model Selection -->
					<div class="nodrag">
						<label class="mb-1 block text-[10px] font-medium text-zinc-400">rvc model</label>
						<Select
							value={[data.voiceId || '']}
							onValueChange={(value) => {
								let voiceId = Array.isArray(value) ? value.at(-1) : value;

								updateNodeData(nodeId, { ...data, voiceId });
							}}
						>
							<SelectTrigger
								class="!h-[30px] w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-[10px] text-zinc-100 focus:border-zinc-500 focus:outline-none"
							>
								{#if data.voiceId}
									{$voicesStore.data?.rvcModels?.find((model) => model.id === data.voiceId)?.name ||
										data.voiceId}
								{:else if $voicesStore.data?.rvcModels?.[0]}
									{$voicesStore.data.rvcModels[0].name}
								{:else}
									Select RVC model
								{/if}
							</SelectTrigger>
							<SelectContent class="max-h-60 border-zinc-600 bg-zinc-800">
								<SelectItem value="" class="text-[10px] text-zinc-100 hover:bg-zinc-700">
									None (use emotion voice only)
								</SelectItem>
								{#if $voicesStore.loading}
									<SelectItem value="" class="text-[10px] text-zinc-400" disabled
										>Loading models...</SelectItem
									>
								{:else if $voicesStore.error}
									<SelectItem value="" class="text-[10px] text-red-400" disabled
										>Error loading models</SelectItem
									>
								{:else if $voicesStore.data?.rvcModels}
									{#each $voicesStore.data.rvcModels as model}
										<SelectItem
											value={model.id}
											class="text-[10px] text-zinc-100 hover:bg-zinc-700"
										>
											{model.name}
										</SelectItem>
									{/each}
								{/if}
							</SelectContent>
						</Select>
					</div>

					<!-- Speed -->
					<div class="nodrag">
						<label class="mb-1 block text-[10px] font-medium text-zinc-400">
							Speed: {(data.speed ?? 1).toFixed(2)}
						</label>
						<Slider
							value={[data.speed ?? 1]}
							min={0}
							max={1}
							step={0.01}
							class="w-full"
							onValueChange={(values) => {
								updateNodeData(nodeId, { ...data, speed: values[0] });
							}}
						/>
					</div>

					<!-- Volume -->
					<div class="nodrag">
						<label class="mb-1 block text-[10px] font-medium text-zinc-400">
							Volume: {(data.volume ?? 1).toFixed(2)}
						</label>
						<Slider
							value={[data.volume ?? 1]}
							min={0}
							max={1}
							step={0.01}
							class="w-full"
							onValueChange={(values) => {
								updateNodeData(nodeId, { ...data, volume: values[0] });
							}}
						/>
					</div>

					<!-- Pitch -->
					<div class="nodrag">
						<label class="mb-1 block text-[10px] font-medium text-zinc-400">
							Pitch: {(data.pitch ?? 1).toFixed(2)}
						</label>
						<Slider
							value={[data.pitch ?? 1]}
							min={0}
							max={1}
							step={0.01}
							class="w-full"
							onValueChange={(values) => {
								updateNodeData(nodeId, { ...data, pitch: values[0] });
							}}
						/>
					</div>
				</div>

				<!-- Error display -->
				{#if errorMessage}
					<div class="mt-4 rounded bg-red-900/90 p-2 text-sm text-red-200">
						{errorMessage}
					</div>
				{/if}

				<!-- Playback state indicator -->
				<div class="mt-3 text-center">
					<div class="text-[8px] text-zinc-400">
						Status: <span class="capitalize text-zinc-300">{playbackState}.</span> Powered by
						<a href="https://celestiai.co" class="text-blue-300">CelestiAI</a>.
					</div>
				</div>
			</div>

			<Handle type="source" position={Position.Bottom} class="absolute" />
		</div>
	</div>
</div>
