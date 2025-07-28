<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import CodeEditor from '../CodeEditor.svelte';
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

	const send = (message: unknown) => messageContext.getContext().send(message);

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
				<div></div>

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

				<div class="relative w-[200px]">
					<div class="rounded-lg border border-zinc-600 bg-zinc-900">
						{#if showTextInput}
							<CodeEditor
								value={msgText}
								onchange={(message) => updateNodeData(nodeId, { ...data, message })}
								onrun={sendMessage}
								fontSize="10px"
							/>
						{:else}
							<button
								onclick={sendMessage}
								class="w-full gap-2 rounded bg-transparent px-1 py-2 font-mono text-xs font-medium text-zinc-200 hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{msgText ? msgText.slice(0, 20) : '<messagebox>'}
							</button>
						{/if}
					</div>
				</div>

				<Handle type="source" position={Position.Bottom} class="z-1" />
			</div>
		</div>
	</div>
</div>
