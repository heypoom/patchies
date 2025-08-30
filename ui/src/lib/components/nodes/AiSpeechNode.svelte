<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import Slider from '$lib/components/ui/slider/slider.svelte';
	import { voicesStore, fetchVoices } from '$lib/stores/voices';
	import { audioUrlCache } from '$lib/stores/audioCache';
	import { omit } from 'lodash';
	import { AudioSystem } from '$lib/audio/AudioSystem';

	type TTSOptions = {
		text: string;
		emotionVoice?: string;
		language?: string;
		speed?: number;
		volume?: number;
		pitch?: number;
		voiceId?: string;
	};

	let {
		id: nodeId,
		data
	}: {
		id: string;
		data: TTSOptions;
	} = $props();

	let messageContext: MessageContext;
	let audioSystem = AudioSystem.getInstance();
	let errorMessage = $state<string | null>(null);
	let showAdvancedSettings = $state(false);
	let isLoading = $state(false);

	const audioCacheKey = $derived.by(() => JSON.stringify(data));

	const { updateNodeData } = useSvelteFlow();

	const defaultVoiceId = 'Mita';
	const defaultVoiceEmotion = 'Cheerful_Female';

	const ttsOptions = $derived.by(() => ({
		text: data.text,
		emotionVoice: data.emotionVoice ?? defaultVoiceEmotion,
		language: data.language || 'th',
		speed: data.speed ?? 1,
		volume: data.volume ?? 1,
		pitch: data.pitch ?? 1,
		voiceId: data.voiceId ?? defaultVoiceId
	}));

	function setTTSOptionsFromMessage(m: Partial<TTSOptions>) {
		updateNodeData(nodeId, {
			...data,
			...(m.text && { text: m.text }),
			...(m.emotionVoice && { emotionVoice: m.emotionVoice }),
			...(m.language && { language: m.language }),
			...(m.speed !== undefined && { speed: m.speed }),
			...(m.volume !== undefined && { volume: m.volume }),
			...(m.pitch !== undefined && { pitch: m.pitch }),
			...(m.voiceId && { voiceId: m.voiceId ?? defaultVoiceId })
		});
	}

	const handleMessage: MessageCallbackFn = (message) => {
		try {
			match(message)
				.with(P.string, (text) => {
					updateNodeData(nodeId, { ...data, text });
					setTimeout(() => generateSpeech({ playback: true }), 5);
				})
				.with({ type: P.union('play', 'bang') }, () => {
					playback();
				})
				.with({ type: 'speak' }, (m) => {
					setTTSOptionsFromMessage(m);
					setTimeout(() => generateSpeech({ playback: true }), 5);
				})
				.with({ type: 'load' }, (m) => {
					setTTSOptionsFromMessage(m);
					setTimeout(() => generateSpeech({ playback: false }), 5);
				})
				.with({ type: 'set' }, (m) => {
					setTTSOptionsFromMessage(m);
				})
				.with({ type: 'stop' }, () => {
					audioSystem.send(nodeId, 'message', { type: 'stop' });
				})
				.otherwise(() => {
					// Forward other messages to AudioSystem for audio manipulation
					audioSystem.send(nodeId, 'message', message);
				});
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		}
	};

	function playback() {
		const cachedUrl = $audioUrlCache[audioCacheKey];

		if (!cachedUrl) {
			generateSpeech({ playback: true });
			return;
		}

		// Load URL and play through AudioSystem
		audioSystem.send(nodeId, 'url', cachedUrl);
		audioSystem.send(nodeId, 'message', { type: 'bang' });
	}

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);

		audioSystem.createAudioObject(nodeId, 'soundfile~', []);

		fetchVoices();
	});

	onDestroy(() => {
		if (messageContext) {
			messageContext.queue.removeCallback(handleMessage);
			messageContext.destroy();
		}

		audioSystem.removeAudioObject(nodeId);
	});

	function togglePlayback() {
		const cachedUrl = $audioUrlCache[audioCacheKey];
		if (!cachedUrl) return;

		audioSystem.send(nodeId, 'message', { type: 'bang' });
	}

	function playAudio(url: string) {
		audioSystem.send(nodeId, 'url', url);
		audioSystem.send(nodeId, 'message', { type: 'bang' });
	}

	async function generateSpeech({ playback = true }: { playback?: boolean } = {}) {
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
			if (playback) playAudio(cachedUrl);

			return;
		}

		errorMessage = null;
		isLoading = true;

		try {
			const isMita = ttsOptions.voiceId === 'Mita';

			const endpoint = isMita
				? 'https://api.celestiai.co/api/v1/tts-turbo/tts-mita'
				: 'https://api.celestiai.co/api/v1/tts-turbo/tts';

			const body = isMita ? omit(ttsOptions, ['voiceId']) : ttsOptions;

			const response = await fetch(endpoint, {
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

				if (playback) playAudio(json.fileUrl);
			} else {
				errorMessage = json.message || 'Speech generation failed';
			}
		} catch (error) {
			if (error instanceof Error) {
				errorMessage = `Error generating speech: ${error.message}`;
			}
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="group relative font-mono">
	<div class="flex flex-col gap-2">
		<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
			<div class="z-10 rounded-lg bg-transparent px-2 py-1">
				<div class="font-mono text-xs font-medium text-zinc-400">ai.tts</div>
			</div>

			<div class="flex gap-1">
				<!-- Settings Button -->
				<button
					class="rounded p-1 transition-all hover:bg-zinc-700"
					onclick={() => (showAdvancedSettings = !showAdvancedSettings)}
					title="Toggle Settings"
				>
					<Icon
						icon={showAdvancedSettings ? 'lucide:chevron-up' : 'lucide:settings'}
						class="h-4 w-4 text-zinc-300"
					/>
				</button>

				<!-- Generate Button -->
				<button
					class={[
						'rounded p-1 transition-all hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50'
					]}
					onclick={() => generateSpeech()}
					disabled={!!$audioUrlCache[audioCacheKey] || isLoading}
					title={isLoading ? 'Generating...' : 'Generate Speech'}
				>
					<Icon
						icon={isLoading ? 'lucide:loader-2' : 'lucide:sparkles'}
						class={`h-4 w-4 text-zinc-300 ${isLoading ? 'animate-spin' : ''}`}
					/>
				</button>

				<!-- Play Button -->
				{#if $audioUrlCache[audioCacheKey]}
					<button
						class="rounded p-1 transition-all hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-30"
						onclick={togglePlayback}
						title="Play"
					>
						<Icon icon="lucide:play" class="h-4 w-4 text-zinc-300" />
					</button>
				{/if}
			</div>
		</div>

		<div class="relative">
			<Handle type="target" position={Position.Top} class="z-1 absolute" />

			<div>
				<!-- Main Text Input -->
				<textarea
					value={ttsOptions.text}
					placeholder="Enter text to read..."
					class="focus:outline-one nodrag h-20 w-full min-w-60 resize-none rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-400 outline-none focus:border-zinc-500"
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

				<!-- Advanced Settings Section -->
				{#if showAdvancedSettings}
					<div class="space-y-3 pb-6 pt-3">
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
									{:else}
										Select RVC model
									{/if}
								</SelectTrigger>
								<SelectContent class="max-h-60 border-zinc-600 bg-zinc-800">
									{#if $voicesStore.loading}
										<SelectItem value="" class="text-[10px] text-zinc-400" disabled
											>Loading models...</SelectItem
										>
									{:else if $voicesStore.error}
										<SelectItem value="" class="text-[10px] text-red-400" disabled
											>Error loading models</SelectItem
										>
									{:else if $voicesStore.data?.rvcModels}
										<SelectItem value="Mita" class="text-[10px] text-zinc-400"
											>Mita (Low-Latency)</SelectItem
										>

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
				{/if}

				<!-- Error display -->
				{#if errorMessage}
					<div class="mt-4 rounded bg-red-900/90 p-2 text-sm text-red-200">
						{errorMessage}
					</div>
				{/if}
			</div>

			<Handle
				type="source"
				position={Position.Bottom}
				class="z-1 absolute !bottom-[2px] !bg-blue-500"
			/>
		</div>
	</div>
</div>
