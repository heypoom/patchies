<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import Icon from '@iconify/svelte';

	let { id: nodeId, data }: { id: string; data: { text: string } } = $props();

	const { updateNodeData } = useSvelteFlow();

	const messageContext = new MessageContext(nodeId);

	let textareaElement: HTMLTextAreaElement;

	const text = $derived(data.text || '');
	const setText = (text: string) => updateNodeData(nodeId, { ...data, text });

	const handleMessage: MessageCallbackFn = (message) => {
		match(message)
			.with(P.string, (text) => {
				setText(text);
			})
			.with({ type: 'bang' }, () => {
				messageContext.send(text);
			})
			.with({ type: 'clear' }, () => {
				setText('');
			});
	};

	onMount(() => {
		messageContext.queue.addCallback(handleMessage);
	});

	onDestroy(() => {
		messageContext.queue.removeCallback(handleMessage);
		messageContext.destroy();
	});

	function handleTextChange(event: Event) {
		const target = event.target as HTMLTextAreaElement;
		setText(target.value);
	}

	function sendText() {
		messageContext.send(text);
	}
</script>

<div class="group relative font-mono">
	<div class="flex flex-col gap-2">
		<!-- Floating Header -->
		<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
			<div class="z-10 rounded-lg bg-transparent px-2 py-1">
				<div class="font-mono text-xs font-medium text-zinc-400">textbox</div>
			</div>

			<div class="flex gap-1 transition-opacity group-hover:opacity-100 sm:opacity-0">
				<button
					onclick={sendText}
					class="rounded p-1 transition-all hover:bg-zinc-700"
					title="Send (or Shift + Enter)"
				>
					<Icon icon="lucide:play" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>
		</div>

		<div class="relative">
			<StandardHandle port="inlet" type="message" total={1} index={0} />

			<div>
				<!-- Text Input -->
				<textarea
					bind:this={textareaElement}
					value={text}
					oninput={handleTextChange}
					placeholder="Enter text here..."
					class="focus:outline-one nodrag h-24 w-full min-w-60 resize-none rounded border border-zinc-600 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-400 outline-none focus:border-zinc-500 focus:bg-zinc-800"
					onkeydown={(e) => {
						if (e.key === 'Enter' && e.shiftKey) {
							e.preventDefault();

							sendText();
						}
					}}
				></textarea>
			</div>

			<StandardHandle port="outlet" type="message" total={1} index={0} class="!bottom-0.5" />
		</div>
	</div>
</div>
