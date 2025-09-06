<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { onDestroy, onMount } from 'svelte';
	import { MessageContext } from '$lib/messages/MessageContext';

	let { id: nodeId, selected }: { id: string; selected: boolean } = $props();

	let messageContext: MessageContext;

	let isFlashing = $state(false);

	const messageCallback = () => {
		isFlashing = true;

		messageContext.send({ type: 'bang' });

		setTimeout(() => {
			isFlashing = false;
		}, 150);
	};

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(messageCallback);

		return () => {
			messageContext.queue.removeCallback(messageCallback);
			messageContext.destroy();
		};
	});

	const borderColor = $derived(selected ? '!border-zinc-400' : '!border-zinc-600');

	const handleClass = $derived(selected ? '!bg-zinc-700' : '!bg-zinc-900');
</script>

<div class="relative">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="relative">
				<Handle type="target" position={Position.Top} class={[borderColor, handleClass]} />

				<button
					onclick={() => messageContext.send({ type: 'bang' })}
					class={[
						'h-10 w-10 cursor-pointer rounded-full border font-mono text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700 active:bg-zinc-600',
						borderColor,
						isFlashing ? 'bg-zinc-500' : 'bg-zinc-900'
					]}
					aria-label="send bang"
				>
				</button>

				<Handle
					type="source"
					position={Position.Bottom}
					class={['absolute !bottom-[1px] z-1', borderColor, handleClass]}
				/>
			</div>
		</div>
	</div>
</div>
