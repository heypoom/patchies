<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { P2PManager, type P2PMessageHandler } from '$lib/p2p/P2PManager';
	import { match, P } from 'ts-pattern';

	let {
		id: nodeId,
		data,
		selected
	}: { id: string; data: { channel: string }; selected: boolean } = $props();

	const { updateNodeData } = useSvelteFlow();
	const messageContext = new MessageContext(nodeId);
	const p2pManager = P2PManager.getInstance();

	let channel = $derived(data.channel || '1');
	let showChannelInput = $state(false);
	let peerCount = $state(0);
	let messagesReceived = $state(0);
	let lastMessage = $state<unknown>(null);
	let unsubscribe: (() => void) | null = null;

	onMount(() => {
		p2pManager.initialize();
		messageContext.queue.addCallback(handleMessage);
		subscribeToChannel();

		// Update peer count periodically
		const interval = setInterval(() => {
			peerCount = p2pManager.getPeerCount();
		}, 1000);

		return () => {
			clearInterval(interval);
		};
	});

	onDestroy(() => {
		unsubscribe?.();

		messageContext.queue.removeCallback(handleMessage);
		messageContext.destroy();
	});

	// Subscribe to P2P channel messages
	function subscribeToChannel() {
		unsubscribe?.();

		const messageHandler: P2PMessageHandler = (data, peer) => {
			messagesReceived++;
			lastMessage = data;

			// Forward received message to connected nodes
			messageContext.send(data);
		};

		unsubscribe = p2pManager.subscribeToChannel(channel, messageHandler);
	}

	// Re-subscribe when channel changes
	$effect(() => {
		if (channel) subscribeToChannel();
	});

	const handleMessage: MessageCallbackFn = (message) => {
		try {
			match(message)
				.with({ type: 'set-channel', channel: P.union(P.string, P.number) }, ({ channel }) => {
					updateNodeData(nodeId, { ...data, channel: String(channel) });
				})
				.otherwise(() => {});
		} catch (error) {
			console.error('NetRecvNode handleMessage error:', error);
		}
	};

	const borderColor = $derived(selected ? 'border-green-400' : 'border-green-600');
</script>

<div class="relative">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div></div>

				<button
					class="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700"
					onclick={() => (showChannelInput = !showChannelInput)}
					title="Edit Channel"
				>
					<Icon
						icon={showChannelInput ? 'lucide:chevron-up' : 'lucide:edit'}
						class="h-4 w-4 text-zinc-300"
					/>
				</button>
			</div>

			<div class="relative">
				<StandardHandle port="inlet" type="message" total={1} index={0} />

				<div class="relative">
					{#if showChannelInput}
						<input
							class={[
								'nodrag w-full min-w-[80px] rounded-lg border bg-zinc-900 px-3 py-2 text-center text-sm text-zinc-200 focus:ring-1 focus:ring-green-500 focus:outline-none',
								borderColor
							].join(' ')}
							type="text"
							value={channel}
							oninput={(e) => updateNodeData(nodeId, { ...data, channel: e.currentTarget.value })}
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									showChannelInput = false;
								}
							}}
							placeholder="channel"
						/>
					{:else}
						<div
							class={[
								'flex min-w-[80px] flex-col items-center justify-center rounded-lg border bg-zinc-900 px-3 py-2',
								borderColor
							].join(' ')}
						>
							<div class="mb-1 flex items-center gap-1 font-mono">
								<span class="text-xs font-medium text-green-200">netrecv {channel}</span>
							</div>

							<div class="font-mono text-[10px] text-zinc-500">
								{peerCount} peer{peerCount === 1 ? '' : 's'}
							</div>
						</div>
					{/if}
				</div>

				<StandardHandle port="outlet" type="message" total={1} index={0} />
			</div>
		</div>
	</div>
</div>
