<script lang="ts">
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { LiveMusicManager, type Prompt } from '$lib/music/LiveMusicManager';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import type { LiveMusicGenerationConfig, Scale } from '@google/genai';
	import JSON5 from 'json5';
	import X from '@lucide/svelte/icons/x';

	let { id: nodeId }: { id: string } = $props();

	let musicManager: LiveMusicManager;
	let messageContext: MessageContext;
	let errorMessage = $state<string | null>(null);
	let currentPrompt = $state('');
	let currentWeight = $state(0.5);
	let prompts = $state(new Map<string, Prompt>());

	let playbackState = $state<'stopped' | 'loading' | 'playing' | 'paused'>('stopped');

	onMount(() => {
		musicManager = new LiveMusicManager(nodeId);
		messageContext = new MessageContext(nodeId);

		const unsubscribePlayback = musicManager.playbackState.subscribe((state) => {
			playbackState = state;
		});

		const unsubscribeError = musicManager.errorMessage.subscribe((message) => {
			if (message) {
				errorMessage = message;

				setTimeout(() => {
					errorMessage = null;
					musicManager.errorMessage.set(null);
				}, 5000);
			}
		});

		prompts = musicManager.getPrompts();

		const context = messageContext.getContext();
		context.onMessage(handleMessage);

		return () => {
			unsubscribePlayback();
			unsubscribeError();
		};
	});

	onDestroy(() => {
		musicManager?.destroy();
		messageContext?.destroy();
	});

	const handleMessage: MessageCallbackFn = (message) => {
		try {
			match(message)
				.with({ type: 'bang' }, () => {
					musicManager.playOrPause();
				})
				.with({ type: 'play' }, () => {
					musicManager.play();
				})
				.with({ type: 'pause' }, () => {
					musicManager.pause();
				})
				.with({ type: 'addPrompt', prompt: P.string, weight: P.number }, ({ prompt, weight }) => {
					addPrompt(prompt, weight);
				})
				.with({ type: 'deletePrompt', prompt: P.string }, ({ prompt }) => {
					removePrompt(prompt);
				})
				.with({ type: 'setPrompts', prompts: P.nonNullable }, (data) => {
					musicManager.setPrompts(data.prompts);
					prompts = musicManager.getPrompts();
				})
				.with(
					{
						type: P.union(
							'temperature',
							'topK',
							'seed',
							'guidance',
							'bpm',
							'density',
							'brightness'
						),
						value: P.number
					},
					({ type, value }) => {
						musicManager.updateConfig({ [type]: value });
					}
				)
				.with({ type: 'scale', value: P.string }, ({ value }) => {
					musicManager.updateConfig({ scale: value as Scale });
				})
				.with({ type: 'config', config: P.any }, ({ config }) => {
					if (config) {
						musicManager.updateConfig(config as LiveMusicGenerationConfig);
					}
				})
				.with(P.string, (prompt) => {
					try {
						const parsed = JSON5.parse(prompt);

						const isWeightedPrompts =
							parsed &&
							typeof parsed === 'object' &&
							Object.values(parsed).every((v) => typeof v === 'number');

						if (isWeightedPrompts) {
							musicManager.setPrompts(parsed);
							prompts = musicManager.getPrompts();
						} else if (typeof parsed === 'string') {
							addPrompt(parsed, 1);
						}
					} catch (error) {
						addPrompt(prompt, 1);
					}
				});
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		}
	};

	function addPrompt(text?: string, weight?: number) {
		const promptText = text || currentPrompt.trim();
		const promptWeight = weight !== undefined ? weight : currentWeight;

		if (!promptText) return;

		musicManager.addPrompt(promptText, promptWeight);
		prompts = musicManager.getPrompts();

		// Clear input if we used it
		if (!text) {
			currentPrompt = '';
		}
	}

	function updatePromptWeight(text: string, weight: number) {
		musicManager.updatePromptWeight(text, weight);
		prompts = musicManager.getPrompts();
	}

	function removePrompt(text: string) {
		musicManager.removePrompt(text);
		prompts = musicManager.getPrompts();
	}

	function togglePlayback() {
		musicManager.playOrPause();
	}

	function getPlayIcon() {
		return match(playbackState)
			.with(P.union('playing'), () => 'lucide:pause')
			.with('loading', () => 'lucide:loader-2')
			.otherwise(() => 'lucide:play');
	}

	function getPlayTitle() {
		return match(playbackState)
			.with('playing', () => 'Pause')
			.with('loading', () => 'Loading.. Click to stop.')
			.otherwise(() => 'Play');
	}
</script>

<div class="group relative font-mono">
	<div class="flex flex-col gap-2">
		<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
			<div class="z-10 rounded-lg bg-transparent px-2 py-1">
				<div class="font-mono text-xs font-medium text-zinc-400">ai.music</div>
			</div>

			<div class="flex gap-1">
				<button
					class="cursor-pointer rounded p-1 transition-all hover:bg-zinc-700"
					onclick={togglePlayback}
					title={getPlayTitle()}
				>
					<Icon icon={getPlayIcon()} class={['h-4 w-4 text-zinc-300']} />
				</button>
			</div>
		</div>

		<div class="relative">
			<StandardHandle port="inlet" type="message" total={1} index={0} />

			<div class="w-80 rounded-lg border border-zinc-600 bg-zinc-900 p-4">
				<!-- Add Prompt Section -->
				<div class="mb-2">
					<div class="nodrag mb-2">
						<input
							id="prompt-input"
							bind:value={currentPrompt}
							placeholder="Enter music prompt..."
							class="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									addPrompt();
								}
							}}
						/>
					</div>
				</div>

				<!-- Active Prompts -->
				<div>
					{#if prompts.size === 0}
						<div class="text-sm text-zinc-400">No prompts added yet</div>
					{:else}
						<div class="nodrag cursor-default space-y-2">
							{#each Array.from(prompts.entries()) as [text, prompt] (text)}
								<div class="rounded border border-zinc-600 bg-zinc-800 p-4">
									<div class="mb-2 flex w-full justify-between">
										<div class="text-sm text-zinc-100">{prompt.text}</div>

										<button
											onclick={() => removePrompt(text)}
											class="rounded text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200"
											title="Remove prompt"
										>
											<X class="h-3 w-3"  />
										</button>
									</div>

									<div class="nodrag flex items-center gap-2">
										<span class="text-[10px] text-zinc-300">weight</span>

										<input
											type="range"
											value={prompt.weight}
											min="0"
											max="1"
											step="0.1"
											oninput={(e) => {
												const target = e.target as HTMLInputElement;
												updatePromptWeight(text, parseFloat(target.value));
											}}
											class="max-w-[180px]"
										/>

										<span class="text-xs text-zinc-300">{prompt.weight.toFixed(1)}</span>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Error display -->
				{#if errorMessage}
					<div class="mt-4 rounded bg-red-900/90 p-2 text-sm text-red-200">
						{errorMessage}
					</div>
				{/if}

				<!-- Playback state indicator -->
				<div class="mt-4 text-center">
					<div class="text-[10px] text-zinc-400">
						Status: <span class="text-zinc-300 capitalize">{playbackState}</span>
					</div>
				</div>
			</div>

			<StandardHandle
				port="outlet"
				type="audio"
				id="audio-out"
				title="Audio Outlet"
				total={1}
				index={0}
			/>
		</div>
	</div>
</div>
