<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { LiveMusicManager, type Prompt } from '$lib/music/LiveMusicManager';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { Message } from '$lib/messages/MessageSystem';

	let { id: nodeId }: { id: string } = $props();

	let musicManager: LiveMusicManager;
	let messageContext: MessageContext;
	let errorMessage = $state<string | null>(null);
	let currentPrompt = $state('');
	let currentWeight = $state(0.5);
	let prompts = $state(new Map<string, Prompt>());

	// Subscribe to global playback state
	let playbackState = $state<'stopped' | 'loading' | 'playing' | 'paused'>('stopped');

	onMount(() => {
		// Initialize manager and message context
		musicManager = LiveMusicManager.getInstance();
		messageContext = new MessageContext(nodeId);

		// Subscribe to playback state
		const unsubscribePlayback = musicManager.playbackState.subscribe((state) => {
			playbackState = state;
		});

		// Subscribe to error messages
		const unsubscribeError = musicManager.errorMessage.subscribe((message) => {
			if (message) {
				errorMessage = message;
				setTimeout(() => {
					errorMessage = null;
					musicManager.errorMessage.set(null);
				}, 5000);
			}
		});

		// Subscribe to current prompts
		prompts = musicManager.getPrompts();

		// Set up message handling
		const context = messageContext.getContext();

		context.onMessage((message: Message) => {
			handleMessage(message);
		});

		return () => {
			unsubscribePlayback();
			unsubscribeError();
		};
	});

	onDestroy(() => {
		if (messageContext) {
			messageContext.destroy();
		}
	});

	function handleMessage(message: Message) {
		try {
			switch (message.data?.type) {
				case 'play':
					musicManager.play();
					break;
				case 'pause':
					musicManager.pause();
					break;
				case 'addPrompt':
					if (message.data.prompt && typeof message.data.weight === 'number') {
						addPrompt(message.data.prompt, message.data.weight);
					}
					break;
				case 'deletePrompt':
					if (message.data.prompt) {
						removePrompt(message.data.prompt);
					}
					break;
				case 'setPrompts':
					if (message.data.prompts && typeof message.data.prompts === 'object') {
						musicManager.setPrompts(message.data.prompts);
						prompts = musicManager.getPrompts();
					}
					break;
			}
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		}
	}

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
		musicManager.playPause();
	}

	function getPlayIcon() {
		switch (playbackState) {
			case 'playing':
				return 'lucide:pause';
			case 'loading':
				return 'lucide:loader-2';
			default:
				return 'lucide:play';
		}
	}

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
</script>

<div class="group relative">
	<div class="flex flex-col gap-2">
		<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
			<div class="z-10 rounded-lg bg-transparent px-2 py-1">
				<div class="font-mono text-xs font-medium text-zinc-100">ai.music</div>
			</div>

			<div class="flex gap-1">
				<button
					class="rounded p-1 transition-all hover:bg-zinc-700 disabled:opacity-50"
					onclick={togglePlayback}
					disabled={playbackState === 'loading'}
					title={getPlayTitle()}
				>
					<Icon
						icon={getPlayIcon()}
						class={['h-4 w-4 text-zinc-300', playbackState === 'loading' ? 'animate-spin' : '']}
					/>
				</button>
			</div>
		</div>

		<div class="relative">
			<Handle type="target" position={Position.Top} class="z-1" />

			<div class="w-80 rounded-lg border border-zinc-600 bg-zinc-800 p-4">
				<!-- Add Prompt Section -->
				<div class="mb-4">
					<label for="prompt-input" class="mb-2 block text-sm font-medium text-zinc-200"
						>Add Prompt</label
					>

					<div class="nodrag mb-2">
						<input
							id="prompt-input"
							bind:value={currentPrompt}
							placeholder="Enter music prompt..."
							class="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									addPrompt();
								}
							}}
						/>
					</div>

					<div class="nodrag mb-2 flex items-center gap-2">
						<label for="weight-input" class="text-sm text-zinc-300">Weight:</label>
						<input
							id="weight-input"
							type="range"
							bind:value={currentWeight}
							min="0"
							max="1"
							step="0.1"
							class="flex-1"
						/>
						<span class="text-sm text-zinc-300">{currentWeight.toFixed(1)}</span>
					</div>
					<button
						onclick={() => addPrompt()}
						disabled={!currentPrompt.trim()}
						class="w-full rounded bg-zinc-600 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-500 disabled:opacity-50"
					>
						Add Prompt
					</button>
				</div>

				<!-- Active Prompts -->
				<div>
					<div class="mb-2 block text-sm font-medium text-zinc-200">Active Prompts</div>
					{#if prompts.size === 0}
						<div class="text-sm text-zinc-400">No prompts added yet</div>
					{:else}
						<div class="nodrag cursor-default space-y-2">
							{#each Array.from(prompts.entries()) as [text, prompt] (text)}
								<div class="rounded border border-zinc-600 bg-zinc-700 p-3">
									<div class="mb-2 flex w-full justify-between">
										<div class="text-sm text-zinc-100">{prompt.text}</div>

										<button
											onclick={() => removePrompt(text)}
											class="rounded text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200"
											title="Remove prompt"
										>
											<Icon icon="lucide:x" class="h-3 w-3" />
										</button>
									</div>

									<div class="nodrag flex items-center gap-2">
										<span class="text-xs text-zinc-300">Weight:</span>
										<input
											type="range"
											value={prompt.weight}
											min="0"
											max="1"
											step="0.1"
											class="flex-1"
											oninput={(e) => {
												const target = e.target as HTMLInputElement;
												updatePromptWeight(text, parseFloat(target.value));
											}}
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
					<div class="text-xs text-zinc-400">
						Status: <span class="capitalize text-zinc-300">{playbackState}</span>
					</div>
				</div>
			</div>

			<Handle type="source" position={Position.Bottom} class="absolute" />
		</div>
	</div>
</div>
