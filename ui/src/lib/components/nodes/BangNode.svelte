<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { MessageContext } from '$lib/messages/MessageContext';

	let { id: nodeId, selected }: { id: string; selected: boolean } = $props();

	const messageContext = new MessageContext(nodeId);

	onDestroy(() => {
		messageContext.destroy();
	});

	function sendBang() {
		messageContext.send({ type: 'bang' });
	}
</script>

<div class="relative">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="relative">
				<button
					onclick={sendBang}
					class={[
						'h-10 w-10 cursor-pointer rounded-full border bg-zinc-900 font-mono text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700 active:bg-zinc-600',
						selected ? 'border-zinc-400' : 'border-zinc-600'
					]}
					aria-label="send bang"
				>
				</button>

				<Handle type="source" position={Position.Bottom} class="z-1" />
			</div>
		</div>
	</div>
</div>
