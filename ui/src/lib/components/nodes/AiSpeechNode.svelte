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
	import { audioUrlCache } from '$lib/stores/audioCache';
	import { omit } from 'lodash';

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

	const audioCacheKey = $derived.by(() => JSON.stringify(data));

	const { updateNodeData } = useSvelteFlow();

	const ttsOptions = $derived.by(() => ({
		text: data.text,
		emotionVoice: data.emotionVoice || 'Cheerful_Female',
		language: data.language || 'th',
		speed: data.speed ?? 1,
		volume: data.volume ?? 1,
		pitch: data.pitch ?? 1,
		voiceId: data.voiceId || ''
	}));

	onMount(() => {
		messageContext = new MessageContext(nodeId);

		const context = messageContext.getContext();

		context.onMessage((message: Message) => {
			const { data } = message;

			match(data.type).with('speech', () => {
				const newData = {
					...data,
					...(ttsOptions.text && { text: ttsOptions.text }),
					...(ttsOptions.emotionVoice && { emotionVoice: ttsOptions.emotionVoice }),
					...(ttsOptions.language && { language: ttsOptions.language }),
					...(ttsOptions.speed !== undefined && { speed: ttsOptions.speed }),
					...(ttsOptions.volume !== undefined && { volume: ttsOptions.volume }),
					...(ttsOptions.pitch !== undefined && { pitch: ttsOptions.pitch }),
					...(ttsOptions.voiceId && { voiceId: ttsOptions.voiceId })
				};

				updateNodeData(nodeId, newData);
				generateSpeech();
			});
		});

		// Fetch voices if not already cached
		fetchVoices();
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
		return match(playbackState)
			.with('playing', () => 'Pause')
			.with('loading', () => 'Loading...')
			.otherwise(() => 'Play');
	}

	function togglePlayback() {
		const cachedUrl = $audioUrlCache[audioCacheKey];
		if (!cachedUrl) return;

		match(playbackState)
			.with('playing', () => {
				if (audio) {
					audio.pause();
					playbackState = 'paused';
				}
			})
			.with('paused', () => {
				playAudio(cachedUrl);
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

		if (!ttsOptions.text) {
			errorMessage = 'Please enter text to generate speech.';
			return;
		}

		const cachedUrl = $audioUrlCache[audioCacheKey];

		if (cachedUrl) {
			playAudio(cachedUrl);
		}

		playbackState = 'loading';
		errorMessage = null;

		try {
			// tts-mita does not support voiceId.
			const body = omit(ttsOptions, ['voiceId']);

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
				$audioUrlCache[audioCacheKey] = json.fileUrl;
				playAudio(json.fileUrl);
			} else {
				errorMessage = json.message || 'Speech generation failed';
				playbackState = 'paused';
			}
		} catch (error) {
			if (error instanceof Error) {
				errorMessage = `Error generating speech: ${error.message}`;
			}

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
					class="rounded p-1 transition-all hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-30"
					onclick={handleGenerate}
					disabled={playbackState === 'loading' || !!$audioUrlCache[audioCacheKey]}
					title="Generate Speech"
				>
					<Icon
						icon={playbackState === 'loading' ? 'lucide:loader' : 'lucide:sparkles'}
						class={[
							'h-4 w-4 text-zinc-300',
							playbackState === 'loading' ? 'animate-spin opacity-30' : ''
						]}
						aria-disabled={playbackState === 'loading'}
					/>
				</button>

				<!-- Play Button (only show if audio is available) -->
				{#if $audioUrlCache[audioCacheKey]}
					<button
						class="rounded p-1 transition-all hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-30"
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
						value={ttsOptions.text}
						placeholder="Enter text to read..."
						class="h-20 w-full resize-none rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
						oninput={(e) => {
							updateNodeData(nodeId, { ...data, text: e.currentTarget.value });
						}}
						onkeydown={(e) => {
							if (e.shiftKey && e.key === 'Enter') {
								generateSpeech();
								e.preventDefault();
								return true;
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
							value={[ttsOptions.emotionVoice]}
							onValueChange={(value) => {
								const emotionVoice = Array.isArray(value) ? value.at(-1) : value;

								updateNodeData(nodeId, { ...data, emotionVoice });
							}}
						>
							<SelectTrigger
								class="!h-[30px] w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-[10px] text-zinc-100 focus:border-zinc-500 focus:outline-none"
							>
								{ttsOptions.emotionVoice}
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
								{/if}
							</SelectContent>
						</Select>
					</div>

					<!-- Language -->
					<div class="nodrag">
						<label class="mb-1 block text-[10px] font-medium text-zinc-400">language</label>
						<input
							type="text"
							value={ttsOptions.language}
							placeholder="Language code (e.g., th, en)"
							class="h-7 w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-[10px] text-zinc-100 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
							onchange={(e) => {
								updateNodeData(nodeId, { ...data, language: e.currentTarget.value });
							}}
						/>
					</div>

					<!-- RVC Model Selection -->
					<div class="nodrag">
						<label class="mb-1 block text-[10px] font-medium text-zinc-400">models</label>

						<Select
							value={[ttsOptions.voiceId]}
							onValueChange={(value) => {
								let voiceId = Array.isArray(value) ? value.at(-1) : value;

								updateNodeData(nodeId, { ...data, voiceId });
							}}
						>
							<SelectTrigger
								class="!h-[30px] w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-[10px] text-zinc-100 focus:border-zinc-500 focus:outline-none"
							>
								{#if ttsOptions.voiceId}
									{$voicesStore.data?.rvcModels?.find((model) => model.id === ttsOptions.voiceId)
										?.name || ttsOptions.voiceId}
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
							Speed: {ttsOptions.speed.toFixed(2)}
						</label>
						<Slider
							value={[ttsOptions.speed]}
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
							Volume: {ttsOptions.volume.toFixed(2)}
						</label>
						<Slider
							value={[ttsOptions.volume]}
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
							Pitch: {ttsOptions.pitch.toFixed(1)}
						</label>
						<Slider
							value={[ttsOptions.pitch]}
							min={0}
							max={12}
							step={0.1}
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
