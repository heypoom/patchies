<script lang="ts">
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';

	let {
		id: nodeId,
		selected
	}: {
		id: string;
		selected: boolean;
	} = $props();

	const messageContext = new MessageContext(nodeId);

	let latestValue = $state<unknown>(undefined);

	// Format value for display
	const displayValue = $derived.by(() => {
		if (latestValue === undefined) return '<peek>';

		if (typeof latestValue === 'string') return latestValue;
		if (typeof latestValue === 'number') return String(latestValue);
		if (typeof latestValue === 'boolean') return String(latestValue);
		if (latestValue === null) return 'null';

		try {
			return JSON.stringify(latestValue, null, 2);
		} catch {
			return String(latestValue);
		}
	});

	const handleMessage: MessageCallbackFn = (message) => {
		latestValue = message;
	};

	onMount(() => {
		messageContext.queue.addCallback(handleMessage);
	});

	onDestroy(() => {
		messageContext.queue.removeCallback(handleMessage);
		messageContext.destroy();
	});

	const containerClass = $derived(
		selected ? 'object-container-selected' : 'object-container-light'
	);
</script>

<div class="relative">
	<StandardHandle port="inlet" type="message" title="Input" total={1} index={0} {nodeId} />

	<div
		class={[
			'max-w-[300px] min-w-[60px] rounded-lg border px-3 py-2 font-mono text-xs text-zinc-200',
			containerClass
		]}
	>
		<pre class="m-0 max-h-[200px] overflow-auto break-all whitespace-pre-wrap">{displayValue}</pre>
	</div>
</div>
