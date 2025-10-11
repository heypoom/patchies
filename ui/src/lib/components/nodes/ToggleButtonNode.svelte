<script lang="ts">
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { onMount } from 'svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import { useSvelteFlow } from '@xyflow/svelte';
	import { match, P } from 'ts-pattern';

	let { id: nodeId, selected, data }: { id: string; selected: boolean; data: any } = $props();

	let messageContext: MessageContext;
	const { updateNodeData } = useSvelteFlow();

	// Get toggle state from node data, default to false
	let isOn = $derived(data.value ?? false);

	const sendValue = () => {
		setTimeout(() => {
			messageContext.send(isOn);
		}, 0);
	};

	const toggleValue = () => {
		const newValue = !isOn;
		updateNodeData(nodeId, { value: newValue });
		sendValue();
	};

	const handleMessage = (message: unknown) => {
		match(message)
			.with({ type: 'bang' }, () => {
				toggleValue();
			})
			.with(P.boolean, (value) => {
				updateNodeData(nodeId, { value });
				sendValue();
			})
			.with(P.number, (value) => {
				updateNodeData(nodeId, { value: value >= 1 });
				sendValue();
			})
			.otherwise(() => {});
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

	const buttonClass = $derived.by(() => {
		const baseClass =
			'h-10 w-10 cursor-pointer rounded-full border font-mono text-xs font-medium transition-colors';

		const glowClass = selected ? 'shadow-glow-md' : 'hover:shadow-glow-sm';

		if (isOn) {
			return `${baseClass} ${borderColor} ${glowClass} bg-zinc-300 hover:bg-zinc-100 active:bg-zinc-400 text-white`;
		} else {
			return `${baseClass} ${borderColor} ${glowClass} bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-600 text-zinc-200`;
		}
	});
</script>

<div class="relative">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="relative">
				<StandardHandle port="inlet" type="message" total={1} index={0} class={handleClass} />

				<button onclick={toggleValue} class={buttonClass} aria-label="toggle button"> </button>

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
