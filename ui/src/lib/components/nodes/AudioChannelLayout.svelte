<script lang="ts">
	import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { AudioSystem } from '$lib/audio/AudioSystem';
	let contentContainer: HTMLDivElement | null = null;

	// Props
	let {
		id: nodeId,
		data,
		selected,
		audioType,
		displayName,
		title
	}: {
		id: string;
		data: {
			channels: number;
		};
		selected: boolean;
		audioType: 'merge~' | 'split~';
		displayName: string;
		title: string;
	} = $props();

	// Get flow utilities to update node data
	const { updateNodeData } = useSvelteFlow();
	const updateNodeInternals = useUpdateNodeInternals();

	let messageContext: MessageContext;
	let audioSystem = AudioSystem.getInstance();
	let contentWidth = $state(100);
	let showChannelEditor = $state(false);
	let channelInput = $state('');

	const channels = $derived(data.channels || 2);

	const containerClass = $derived.by(() => {
		if (selected) return 'border-zinc-400 bg-zinc-800 shadow-glow-md';
		return 'border-zinc-700 bg-zinc-900 hover:shadow-glow-sm';
	});

	const handleMessage: MessageCallbackFn = (message) => {
		match(message)
			.with({ type: 'set-channels', value: P.number }, (m) => {
				updateChannels(m.value);
			})
			.otherwise(() => {});
	};

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);

		audioSystem.createAudioObject(nodeId, audioType, [channels]);
		updateContentWidth();
		channelInput = channels.toString();
	});

	onDestroy(() => {
		messageContext.queue.removeCallback(handleMessage);
		messageContext.destroy();
		audioSystem.removeAudioObject(nodeId);
	});

	function updateContentWidth() {
		if (!contentContainer) return;
		contentWidth = contentContainer.offsetWidth;
	}

	function updateChannels(newChannels?: number) {
		const channelCount = newChannels ?? parseInt(channelInput);

		if (channelCount >= 1 && channelCount <= 32 && channelCount !== channels) {
			updateNodeData(nodeId, { channels: channelCount });
			audioSystem.send(nodeId, 'channels', channelCount);

			setTimeout(() => {
				updateNodeInternals(nodeId);
				updateContentWidth();
			}, 5);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			updateChannels();
			showChannelEditor = false;
		} else if (e.key === 'Escape') {
			channelInput = channels.toString();
			showChannelEditor = false;
		}
	}

	function handleInputChange() {
		updateChannels();
	}

	let minContainerWidth = $derived.by(() => {
		const baseWidth = 20;
		let handleWidth = 20;
		return baseWidth + channels * handleWidth;
	});
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2" bind:this={contentContainer}>
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div></div>

				<div>
					<button
						class="rounded p-1 transition-opacity hover:bg-zinc-700 group-hover:opacity-100 sm:opacity-0"
						onclick={(e) => {
							e.preventDefault();
							e.stopPropagation();

							channelInput = channels.toString();
							showChannelEditor = !showChannelEditor;
						}}
						title="Configure channels"
					>
						<Icon icon="lucide:settings" class="h-4 w-4 text-zinc-300" />
					</button>
				</div>
			</div>

			<div class="relative">
				{#if audioType === 'merge~'}
					<!-- Channel inputs for merger -->
					<div>
						{#each Array.from({ length: channels }) as _, index}
							<StandardHandle
								port="inlet"
								type="audio"
								id={index}
								title={`Channel ${index + 1} Input`}
								total={channels}
								{index}
								class="top-0"
							/>
						{/each}
					</div>
				{:else}
					<!-- Single multichannel input for splitter -->
					<div>
						<StandardHandle
							port="inlet"
							type="audio"
							title="Multichannel Input"
							total={1}
							index={0}
							class="top-0"
						/>
					</div>
				{/if}

				<button
					class={['cursor-pointer rounded-lg border px-3 py-2', containerClass]}
					style={`min-width: ${minContainerWidth}px`}
					{title}
				>
					<div class="flex items-center justify-center gap-2">
						<div class="font-mono text-xs text-zinc-300">{displayName}</div>
						<div class="font-mono text-xs text-zinc-400">{channels}</div>
					</div>
				</button>

				{#if audioType === 'merge~'}
					<!-- Single multichannel output for merger -->
					<div>
						<StandardHandle
							port="outlet"
							type="audio"
							title="Multichannel Output"
							total={1}
							index={0}
							class="bottom-0"
						/>
					</div>
				{:else}
					<!-- Channel outputs for splitter -->
					<div>
						{#each Array.from({ length: channels }) as _, index}
							<StandardHandle
								port="outlet"
								type="audio"
								id={index}
								title={`Channel ${index + 1} Output`}
								total={channels}
								{index}
								class="bottom-0"
							/>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>

	{#if showChannelEditor}
		<div class="absolute" style="left: {contentWidth + 10}px">
			<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
				<button onclick={() => (showChannelEditor = false)} class="rounded p-1 hover:bg-zinc-700">
					<Icon icon="lucide:x" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="rounded-lg border border-zinc-600 bg-zinc-900 p-3 shadow-xl">
				<div class="mb-1 text-[8px] text-zinc-400">Channels (1-32)</div>
				<input
					bind:value={channelInput}
					onkeydown={handleKeydown}
					oninput={handleInputChange}
					class="nodrag w-20 rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
					type="number"
					min="1"
					max="32"
					placeholder="2"
				/>
			</div>
		</div>
	{/if}
</div>
