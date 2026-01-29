<script lang="ts">
	import JSExprBase from './JSExprBase.svelte';

	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: { expr: string; showConsole?: boolean };
		selected: boolean;
	} = $props();
</script>

<JSExprBase
	id={nodeId}
	{data}
	{selected}
	displayPrefix="filter"
	placeholder="$1.type === 'play'"
	outletTitle="Matched"
	requireAllInlets
	onResult={(result, originalMessage, send) => {
		// Filter: send original message if result is truthy
		if (result) {
			send(originalMessage);
		}
	}}
/>
