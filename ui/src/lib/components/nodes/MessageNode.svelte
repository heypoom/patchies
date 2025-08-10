<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import Json5 from 'json5';

	import hljs from 'highlight.js/lib/core';
	import javascript from 'highlight.js/lib/languages/javascript';

	import 'highlight.js/styles/night-owl.min.css';

	hljs.registerLanguage('javascript', javascript);

	let {
		id: nodeId,
		data,
		selected
	}: { id: string; data: { message: string }; selected: boolean } = $props();

	const { updateNodeData } = useSvelteFlow();

	const messageContext = new MessageContext(nodeId);

	let showTextInput = $state(false);
	let msgText = $derived(data.message || '');

	let isJsonObject = $derived.by(() => {
		try {
			const result = Json5.parse(data.message);

			return result && typeof result !== 'number';
		} catch {
			return false;
		}
	});

	let highlightedHtml = $derived.by(() => {
		if (!isJsonObject || !msgText) return '';

		try {
			return hljs.highlight(msgText, {
				language: 'javascript',
				ignoreIllegals: true
			}).value;
		} catch (e) {
			return '';
		}
	});

	const handleMessage: MessageCallbackFn = (message) => {
		try {
			match(message)
				.with(P.union(null, undefined, { type: 'bang' }), () => {
					sendMessage();
				})
				.with({ type: 'set', value: P.any }, ({ value }) => {
					let newMsgText: string;
					if (typeof value === 'string') {
						newMsgText = value;
					} else {
						try {
							newMsgText = Json5.stringify(value, null, 2);
						} catch (e) {
							newMsgText = String(value);
						}
					}
					updateNodeData(nodeId, { ...data, message: newMsgText });
				});
		} catch (error) {
			console.error('MessageNode handleMessage error:', error);
		}
	};

	onMount(() => {
		messageContext.queue.addCallback(handleMessage);
	});

	onDestroy(() => {
		messageContext.queue.removeCallback(handleMessage);
		messageContext.destroy();
	});

	const send = (data: unknown) => messageContext.send(data);

	function sendMessage() {
		// Try to send the message as a JSON object
		try {
			send(Json5.parse(msgText));
			return;
		} catch (e) {}

		// If all else fails, send the message as a string
		send(msgText);
	}

	const borderColor = $derived(selected ? 'border-zinc-400' : 'border-zinc-600');
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

				<div class="relative">
					{#if showTextInput}
						<textarea
							value={msgText}
							oninput={(message) =>
								updateNodeData(nodeId, { ...data, message: message.currentTarget.value })}
							class={[
								'nodrag w-full max-w-[200px] resize-none rounded-lg border bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200 focus:outline-none',
								borderColor
							]}
						></textarea>
					{:else}
						<button
							onclick={sendMessage}
							class={[
								'max-w-[200px] rounded-lg border bg-zinc-900 px-3 py-2 text-start font-mono text-xs font-medium text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50',
								borderColor
							]}
						>
							{#if msgText && isJsonObject}
								<code>
									{@html highlightedHtml}
								</code>
							{:else}
								{msgText ? msgText : '<messagebox>'}
							{/if}
						</button>
					{/if}
				</div>

				<Handle type="source" position={Position.Bottom} class="z-1" />
			</div>
		</div>
	</div>
</div>
