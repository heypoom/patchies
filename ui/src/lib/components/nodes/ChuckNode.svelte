<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { AudioSystem } from '$lib/audio/AudioSystem';
	import CommonExprLayout from './CommonExprLayout.svelte';
	import Icon from '@iconify/svelte';
	import { keymap } from '@codemirror/view';
	import type { ChuckShred } from '$lib/audio/ChuckManager';

	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: { expr: string };
		selected: boolean;
	} = $props();

	let isEditing = $state(!data.expr);
	let layoutRef = $state<any>();
	let showSettings = $state(false);

	let messageContext: MessageContext;
	let audioSystem = AudioSystem.getInstance();

	const { updateNodeData } = useSvelteFlow();

	const handleMessage: MessageCallbackFn = (message) => {
		match(message)
			.with(P.string, async (nextExpr) => {
				updateNodeData(nodeId, { expr: nextExpr });
				await send('run', nextExpr);
			})
			.with({ type: P.union('replace', 'bang') }, async () => {
				await send('replace', data.expr);
			})
			.with({ type: 'run' }, async () => {
				await send('run', data.expr);
			})
			.with({ type: 'remove' }, () => {
				removeChuckCode();
			})
			.with({ type: 'stop' }, () => {
				stopChuck();
			})
			.with({ type: P.string }, async (m) => {
				await send(m.type, m);
			});
	};

	const send = (key: string, msg: unknown) => audioSystem.send(nodeId, key, msg);

	const removeChuckCode = () => send('remove', null);
	const removeShred = (shredId: number) => send('removeShred', shredId);
	const stopChuck = () => send('clearAll', null);

	// Get running shreds for the settings panel - access the store value
	let shreds = $state<ChuckShred[]>([]);

	// Custom keybinds for ChucK operations
	const chuckKeymaps = [
		keymap.of([
			{
				key: 'Cmd-\\',
				run: () => {
					handleRun();
					return true;
				}
			}
		])
	];

	const handleExpressionChange = (newExpr: string) => updateNodeData(nodeId, { expr: newExpr });

	const handleRun = () => send('run', data.expr);
	const handleReplace = () => send('replace', data.expr);

	function subscribeShredsStore() {
		const entry = audioSystem.nodesById.get(nodeId);

		if (entry?.type === 'chuck' && entry.chuckManager) {
			const unsubscribe = entry.chuckManager.shredsStore.subscribe((newShreds) => {
				shreds = newShreds;
			});

			return unsubscribe;
		}
	}

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);

		audioSystem.createAudioObject(nodeId, 'chuck');
		subscribeShredsStore();

		if (isEditing) {
			setTimeout(() => layoutRef?.focus(), 10);
		}
	});

	onDestroy(() => {
		messageContext.queue.removeCallback(handleMessage);
		messageContext.destroy();
		audioSystem.removeAudioObject(nodeId);
	});

	const isReplaceDisabled = $derived(!data.expr.trim() || shreds.length === 0);
</script>

{#snippet chuckHandles()}
	<!-- Control inlet for messages and code -->
	<StandardHandle
		port="inlet"
		type="message"
		title="Control Input (code, bang, stop)"
		total={1}
		index={0}
	/>
{/snippet}

{#snippet chuckOutlets()}
	<StandardHandle port="outlet" type="audio" title="Audio Output" total={2} index={0} />

	<StandardHandle port="outlet" type="message" title="Message Output" total={2} index={1} id={0} />
{/snippet}

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<!-- Floating toolbar -->
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="flex gap-1 transition-opacity group-hover:opacity-100 sm:opacity-0">
					<!-- Replace button -->
					<button
						onclick={handleReplace}
						class={['rounded p-1 hover:bg-zinc-700', isReplaceDisabled && 'opacity-50']}
						title="Replace (Cmd+Enter)"
						disabled={isReplaceDisabled}
					>
						<Icon icon="lucide:replace" class="h-4 w-4" />
					</button>

					<!-- Add shred button -->
					<button
						onclick={handleRun}
						class="rounded p-1 hover:bg-zinc-700"
						title="Add Shred (Cmd+\)"
						disabled={!data.expr.trim()}
					>
						<Icon icon="lucide:circle-plus" class="h-4 w-4" />
					</button>

					<!-- Remove button -->
					<button
						onclick={removeChuckCode}
						class="rounded p-1 hover:bg-zinc-700"
						title="Remove (Cmd+Backspace)"
						disabled={shreds.length === 0}
					>
						<Icon icon="lucide:delete" class="h-4 w-4" />
					</button>
				</div>

				<button
					class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
					onclick={() => (showSettings = !showSettings)}
					title="Settings"
				>
					<Icon icon="lucide:settings" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="relative">
				{@render chuckHandles()}

				<CommonExprLayout
					bind:this={layoutRef}
					{nodeId}
					{data}
					{selected}
					expr={data.expr}
					bind:isEditing
					placeholder="SinOsc osc => dac; 1::second => now;"
					editorClass="chuck-node-code-editor"
					onExpressionChange={handleExpressionChange}
					extraExtensions={chuckKeymaps}
					exitOnRun={false}
					onRun={handleReplace}
				/>

				{@render chuckOutlets()}
			</div>
		</div>
	</div>

	{#if showSettings}
		<div class="relative">
			<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
				<button onclick={stopChuck} class="rounded p-1 hover:bg-zinc-700">
					<Icon icon="lucide:trash" class="h-4 w-4 text-zinc-300" />
				</button>

				<button onclick={() => (showSettings = false)} class="rounded p-1 hover:bg-zinc-700">
					<Icon icon="lucide:x" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="nodrag w-64 rounded-lg border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
				<div class="space-y-4">
					<div>
						{#if shreds.length === 0}
							<div class="text-xs text-zinc-500">No running shreds</div>
						{:else}
							<div class="space-y-2">
								{#each shreds as shred (shred.id)}
									<div class="relative flex items-center justify-between">
										<div class="flex-1">
											<div class="font-mono text-xs text-zinc-300">ID: {shred.id}</div>

											<div class="text-xs text-zinc-500">
												{shred.time}
											</div>

											<div class="mt-1 max-w-48 truncate font-mono text-xs text-zinc-400">
												{shred.code.slice(0, 30)}
											</div>
										</div>

										<div class="absolute top-0 right-0">
											<button
												onclick={() => removeShred(shred.id)}
												class="ml-2 rounded p-1 hover:bg-zinc-700"
												title="Remove shred"
											>
												<Icon icon="lucide:x" class="h-3 w-3 text-red-400" />
											</button>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	:global(.chuck-node-code-editor .cm-content) {
		padding: 6px 8px 7px 4px !important;
	}
</style>
