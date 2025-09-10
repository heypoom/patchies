<script lang="ts">
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { onMount } from 'svelte';
	import { MessageContext } from '$lib/messages/MessageContext';

	let { id: nodeId, selected }: { id: string; selected: boolean } = $props();

	let messageContext: MessageContext;

	let isFlashing = $state(false);

	const handleMessage = () => {
		isFlashing = true;

		messageContext.send({ type: 'bang' });

		setTimeout(() => {
			isFlashing = false;
		}, 150);
	};

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);

		return () => {
			messageContext.queue.removeCallback(handleMessage);
			messageContext.destroy();
		};
	});

	const borderColor = $derived(selected ? '!border-zinc-400' : '!border-zinc-600');

	const handleClass = $derived.by(() => {
		return `${selected ? '!bg-gray-400' : '!bg-zinc-900 !border-zinc-600'}`;
	});
</script>

<div class="relative">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="relative">
				<StandardHandle port="inlet" type="message" total={1} index={0} class={handleClass} />

				<button
					onclick={() => messageContext.send({ type: 'bang' })}
					class={[
						'h-10 w-10 cursor-pointer rounded-full border font-mono text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700 active:bg-zinc-600',
						isFlashing ? '!border-transparent bg-zinc-500' : `${borderColor} bg-zinc-900`
					]}
					aria-label="send bang"
				>
				</button>

				<StandardHandle
					port="outlet"
					type="message"
					total={1}
					index={0}
					class={`absolute !bottom-1.5 ${handleClass}`}
				/>
			</div>
		</div>
	</div>
</div>
