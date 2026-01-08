<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import Settings from '@lucide/svelte/icons/settings';
import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import Keyboard from '@lucide/svelte/icons/keyboard';
	import KeyboardOff from '@lucide/svelte/icons/keyboard-off';
	import type { ComponentType } from 'svelte';
	import X from '@lucide/svelte/icons/x';

	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: {
			keybind?: string;
			mode?: 'all' | 'filtered';
			trigger?: 'keydown' | 'keyup' | 'keyupdown';
			repeat?: boolean;
		};
		selected: boolean;
	} = $props();

	const { updateNodeData } = useSvelteFlow();

	let messageContext: MessageContext;
	let showSettings = $state(false);
	let isListening = $state(true);
	let errorMessage = $state<string | null>(null);

	const keybind = $derived(data.keybind ?? '');
	const mode = $derived(data.mode ?? 'filtered');
	const trigger = $derived(data.trigger ?? 'keydown');
	const repeat = $derived(data.repeat ?? false);

	const borderColor = $derived.by(() => {
		if (errorMessage) return 'border-red-500';

		if (selected && isListening) return 'border-green-300';
		if (selected) return 'border-zinc-400';
		if (!isListening) return 'border-zinc-400';

		return 'border-green-400';
	});

	const handleClass = $derived.by(() => {
		return `z-1 transition-opacity ${selected ? '' : 'sm:opacity-0 opacity-30 group-hover:opacity-100'}`;
	});

	const StatusIcon = $derived.by<ComponentType>(() => {
		if (errorMessage) return AlertCircle;
		if (!isListening) return KeyboardOff;
		if (mode === 'all') return Keyboard;

		return Keyboard;
	});

	function handleKeydown(event: KeyboardEvent) {
		if (!isListening) return;

		const target = event.target as HTMLElement;
		const isTyping =
			target instanceof HTMLInputElement ||
			target instanceof HTMLTextAreaElement ||
			target.closest('.cm-editor') ||
			target.closest('.cm-content') ||
			target.contentEditable === 'true';

		// Skip if typing in an input field
		if (isTyping) return;

		// Get the key value
		const key = event.key.toUpperCase();

		// Skip repeated keys if repeat is disabled
		if (!repeat && event.repeat) return;

		// Handle different trigger modes using ts-pattern
		match({ trigger, mode })
			.with({ trigger: 'keydown', mode: 'all' }, () => {
				// Send all keystrokes as strings
				messageContext.send(key);
			})
			.with({ trigger: 'keydown', mode: 'filtered' }, () => {
				// Send bang only when the chosen keybind is pressed
				if (keybind && key === keybind.toUpperCase()) {
					messageContext.send({ type: 'bang' });
				}
			})
			.with({ trigger: 'keyupdown', mode: 'all' }, () => {
				// Send [key, true] for keydown in all mode
				messageContext.send([key, true]);
			})
			.with({ trigger: 'keyupdown', mode: 'filtered' }, () => {
				// Send true only when the chosen keybind is pressed
				if (keybind && key === keybind.toUpperCase()) {
					messageContext.send(true);
				}
			})
			.otherwise(() => {
				// For keyup trigger mode, we don't handle keydown events
			});
	}

	function handleKeyup(event: KeyboardEvent) {
		if (!isListening) return;

		const target = event.target as HTMLElement;
		const isTyping =
			target instanceof HTMLInputElement ||
			target instanceof HTMLTextAreaElement ||
			target.closest('.cm-editor') ||
			target.closest('.cm-content') ||
			target.contentEditable === 'true';

		// Skip if typing in an input field
		if (isTyping) return;

		// Get the key value
		const key = event.key.toUpperCase();

		// Skip repeated keys if repeat is disabled
		if (!repeat && event.repeat) return;

		// Handle different trigger modes using ts-pattern
		match({ trigger, mode })
			.with({ trigger: 'keyupdown', mode: 'all' }, () => {
				// Send [key, false] for keyup in all mode
				messageContext.send([key, false]);
			})
			.with({ trigger: 'keyupdown', mode: 'filtered' }, () => {
				// Send false only when the chosen keybind is released
				if (keybind && key === keybind.toUpperCase()) {
					messageContext.send(false);
				}
			})
			.with({ trigger: 'keyup', mode: 'all' }, () => {
				// Send key on keyup
				messageContext.send(key);
			})
			.with({ trigger: 'keyup', mode: 'filtered' }, () => {
				// Send bang only when the chosen keybind is released
				if (keybind && key === keybind.toUpperCase()) {
					messageContext.send({ type: 'bang' });
				}
			})
			.otherwise(() => {
				// For keydown trigger mode, we don't handle keyup events
			});
	}

	function updateConfig(updates: any) {
		const newData = { ...data, ...updates };
		updateNodeData(nodeId, newData);
	}

	function toggleListening() {
		isListening = !isListening;
		errorMessage = null;
	}

	const handleMessage: MessageCallbackFn = (message) => {
		try {
			match(message)
				.with({ type: 'bang' }, () => {
					toggleListening();
				})
				.with({ type: 'start' }, () => {
					isListening = true;
					errorMessage = null;
				})
				.with({ type: 'stop' }, () => {
					isListening = false;
					errorMessage = null;
				})
				.with({ type: 'toggle' }, () => {
					toggleListening();
				})
				.with(P.string, (key) => {
					// Handle string messages as keybind updates in filtered mode
					if (mode === 'filtered') {
						updateConfig({ keybind: key });
					}
				})
				.otherwise(() => {
					// Ignore other message types
				});
		} catch (error) {
			errorMessage =
				'Failed to handle message: ' + (error instanceof Error ? error.message : String(error));
		}
	};

	onMount(() => {
		messageContext = new MessageContext(nodeId);

		// Add global keydown listener
		document.addEventListener('keydown', handleKeydown);

		// Add global keyup listener
		document.addEventListener('keyup', handleKeyup);

		// Listen for messages to control listening state
		messageContext.queue.addCallback(handleMessage);

		return () => {
			document.removeEventListener('keydown', handleKeydown);
			document.removeEventListener('keyup', handleKeyup);
			messageContext.queue.removeCallback(handleMessage);
			messageContext.destroy();
		};
	});

	onDestroy(() => {
		messageContext?.destroy();
	});
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div></div>

				<button
					class="z-4 rounded p-1 transition-opacity hover:bg-zinc-700 group-hover:opacity-100 sm:opacity-0"
					onclick={() => (showSettings = !showSettings)}
					title="Settings"
				>
					<Settings class="h-4 w-4 text-zinc-300"  />
				</button>
			</div>

			<div class="relative">
				<StandardHandle port="inlet" type="message" total={1} index={0} class={handleClass} />

				<button
					class={[
						'lex-col flex min-h-[32px] min-w-[35px] items-center justify-center rounded-md border bg-zinc-900 px-3 text-zinc-300 hover:bg-zinc-800',
						borderColor,
						selected ? 'shadow-glow-md' : 'hover:shadow-glow-sm'
					]}
					onclick={toggleListening}
					title={isListening ? 'Stop listening' : 'Start listening'}
				>
					{#if mode === 'filtered'}
						<div
							class={['font-mono text-[12px]', isListening ? 'text-green-400' : 'text-zinc-500']}
						>
							{keybind || 'no keybind'}
						</div>
					{:else}
						<StatusIcon
							class={`h-4 w-4 ${isListening ? 'text-green-400' : 'text-zinc-500'}`}
						/>
					{/if}
				</button>

				<StandardHandle port="outlet" type="message" total={1} index={0} />
			</div>
		</div>
	</div>

	{#if showSettings}
		<div class="relative">
			<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
				<button onclick={() => (showSettings = false)} class="rounded p-1 hover:bg-zinc-700">
					<X class="h-4 w-4 text-zinc-300"  />
				</button>
			</div>

			<div class="nodrag w-64 rounded-lg border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
				<div class="space-y-4">
					<div>
						<label class="mb-2 block text-xs font-medium text-zinc-300">Mode</label>
						<div class="flex gap-2">
							<label class="flex items-center">
								<input
									type="radio"
									name="keyboard-mode"
									value="all"
									checked={mode === 'all'}
									onchange={() => updateConfig({ mode: 'all' })}
									class="mr-2 h-3 w-3"
								/>
								<span class="text-xs text-zinc-300">All Keys</span>
							</label>
							<label class="flex items-center">
								<input
									type="radio"
									name="keyboard-mode"
									value="filtered"
									checked={mode === 'filtered'}
									onchange={() => updateConfig({ mode: 'filtered' })}
									class="mr-2 h-3 w-3"
								/>
								<span class="text-xs text-zinc-300">Filtered</span>
							</label>
						</div>
					</div>

					<div>
						<label class="mb-2 block text-xs font-medium text-zinc-300">Trigger</label>
						<div class="flex gap-2">
							<label class="flex items-center">
								<input
									type="radio"
									name="keyboard-trigger"
									value="keydown"
									checked={trigger === 'keydown'}
									onchange={() => updateConfig({ trigger: 'keydown' })}
									class="mr-2 h-3 w-3"
								/>
								<span class="text-xs text-zinc-300">Down</span>
							</label>
							<label class="flex items-center">
								<input
									type="radio"
									name="keyboard-trigger"
									value="keyup"
									checked={trigger === 'keyup'}
									onchange={() => updateConfig({ trigger: 'keyup' })}
									class="mr-2 h-3 w-3"
								/>
								<span class="text-xs text-zinc-300">Up</span>
							</label>
							<label class="flex items-center">
								<input
									type="radio"
									name="keyboard-trigger"
									value="keyupdown"
									checked={trigger === 'keyupdown'}
									onchange={() => updateConfig({ trigger: 'keyupdown' })}
									class="mr-2 h-3 w-3"
								/>
								<span class="text-xs text-zinc-300">Up/Down</span>
							</label>
						</div>
					</div>

					{#if mode === 'filtered'}
						<div>
							<label class="mb-2 block text-xs font-medium text-zinc-300">Keybind</label>

							<input
								type="text"
								value={keybind}
								placeholder="Press a key or type here"
								oninput={(e) => updateConfig({ keybind: (e.target as HTMLInputElement).value })}
								onkeydown={(e) => {
									e.preventDefault();
									updateConfig({ keybind: e.key.toUpperCase() });
								}}
								class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
							/>
						</div>
					{/if}

					<div>
						<label class="mb-2 block text-xs font-medium text-zinc-300">Options</label>

						<label class="flex items-center">
							<input
								type="checkbox"
								checked={repeat}
								onchange={(e) => updateConfig({ repeat: (e.target as HTMLInputElement).checked })}
								class="mr-2 h-3 w-3"
							/>
							<span class="text-xs text-zinc-300">Allow repeated keys</span>
						</label>
					</div>

					{#if errorMessage}
						<div class="rounded border border-red-700 bg-red-900/20 p-2">
							<p class="text-xs text-red-400">{errorMessage}</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
