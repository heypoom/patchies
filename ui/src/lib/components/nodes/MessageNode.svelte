<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { Message } from '$lib/messages/MessageSystem';

	let { id: nodeId, data }: { id: string; data: { message: string } } = $props();

	const { updateNodeData } = useSvelteFlow();

	const messageContext = new MessageContext(nodeId);

	let showTextInput = $state(false);
	let msgText = $derived(data.message || '');

	function handleMessage(message: Message) {
		if (message.data === null || message.data === undefined || message.data?.type === 'bang') {
			sendMessage();
		} else if (message.data.type === 'set') {
			const value = message.data.value;

			if (value === 'string') {
				msgText = value;
			} else {
				try {
					msgText = JSON.stringify(value, null, 2);
				} catch (e) {
					msgText = String(value);
				}
			}

			updateNodeData(nodeId, { ...data, message: msgText });
		}
	}

	onMount(() => {
		messageContext.queue.addCallback(handleMessage);
	});

	onDestroy(() => {
		messageContext.queue.removeCallback(handleMessage);
		messageContext.destroy();
	});

	const send = (data: unknown) => messageContext.createSendFunction()(data);

	function sendMessage() {
		// Try to send the message as a JSON object
		try {
			send(JSON.parse(msgText));
			return;
		} catch (e) {}

		// If all else fails, send the message as a string
		send(msgText);
	}
</script>

<div class="relative">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<button
					class="rounded p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
					onclick={() => (showTextInput = !showTextInput)}
					title="Toggle Message Input"
				>
					<Icon
						icon={showTextInput ? 'lucide:chevron-up' : 'lucide:edit'}
						class="h-4 w-4 text-zinc-300"
					/>
				</button>
			</div>

			<div class="relative">
				<Handle type="target" position={Position.Top} class="z-1" />

				<div class="relative min-w-[100px]">
					{#if showTextInput}
						<textarea
							value={msgText}
							oninput={(message) =>
								updateNodeData(nodeId, { ...data, message: message.currentTarget.value })}
							class="nodrag w-full max-w-[200px] resize-none rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200 focus:outline-none"
						></textarea>
					{:else}
						<button
							onclick={sendMessage}
							class="max-w-[200px] rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-start font-mono text-xs font-medium text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{msgText ? msgText : '<messagebox>'}
						</button>
					{/if}
				</div>

				<Handle type="source" position={Position.Bottom} class="z-1" />
			</div>
		</div>
	</div>
</div>
