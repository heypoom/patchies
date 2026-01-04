<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { AudioService } from '$lib/audio/v2/AudioService';
	import { parseInletCount } from '$lib/utils/expr-parser';
	import CommonExprLayout from './CommonExprLayout.svelte';

	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: { expr: string };
		selected: boolean;
	} = $props();

	let isEditing = $state(!data.expr); // Start in editing mode if no expression
	let inletValues = $state<number[]>([]);

	const messageContext = new MessageContext(nodeId);
	let audioService = AudioService.getInstance();
	let layoutRef = $state<any>();

	const { updateNodeData } = useSvelteFlow();

	const inletCount = $derived.by(() => {
		if (!data.expr.trim()) return 0;

		return parseInletCount(data.expr.trim());
	});

	const handleMessage: MessageCallbackFn = (message, meta) => {
		const nextInletValues = [...inletValues];

		match(message)
			.with(P.union(P.number), (value) => {
				if (meta?.inlet === undefined) return;

				nextInletValues[meta.inlet] = value;
				inletValues = nextInletValues;

				updateAudioInletValues(nextInletValues);
			})
			.with(P.string, (newExpr) => {
				updateNodeData(nodeId, { expr: newExpr });
				updateAudioExpression(newExpr);
			});
	};

	const updateAudioExpression = (expression: string) =>
		audioService.send(nodeId, 'expression', expression);

	// Use `Array.from` to avoid sending Svelte proxies
	const updateAudioInletValues = (values: number[]) =>
		audioService.send(nodeId, 'inletValues', Array.from(values));

	function handleExpressionChange(newExpr: string) {
		updateNodeData(nodeId, { expr: newExpr });
	}

	function handleRun() {
		updateAudioExpression(data.expr);

		// Update inlet count when expression changes
		const newInletCount = parseInletCount(data.expr || '');

		if (newInletCount !== inletValues.length) {
			const prevValues = Array.from(inletValues);

			// Copy old values to the new resized list.
			inletValues = Array.from({ length: newInletCount }, (_, i) =>
				i < prevValues.length ? prevValues[i] : 0
			);

			updateAudioInletValues(inletValues);
		}
	}

	onMount(() => {
		messageContext.queue.addCallback(handleMessage);

		inletValues = new Array(inletCount).fill(0);
		audioService.createNode(nodeId, 'expr~', [null, data.expr]);
		updateAudioInletValues(inletValues);

		if (isEditing) {
			setTimeout(() => layoutRef?.focus(), 10);
		}
	});

	onDestroy(() => {
		messageContext.queue.removeCallback(handleMessage);
		messageContext.destroy();
		audioService.removeNode(audioService.getNodeById(nodeId)!);
	});
</script>

{#snippet audioHandles()}
	<!-- Total inlets = 1 audio inlet + control inlets -->
	{@const totalInlets = 1 + inletCount}

	<!-- Audio input (always present) -->
	<StandardHandle
		port="inlet"
		type="audio"
		title="Audio Input"
		total={totalInlets}
		index={0}
		class="top-0"
	/>

	<!-- Control inlets for $1-$9 variables (only show if there are $ variables) -->
	{#if inletCount > 0}
		{#each Array.from({ length: inletCount }) as _, index}
			<StandardHandle
				port="inlet"
				type="message"
				id={index}
				title={`$${index + 1}`}
				total={totalInlets}
				index={index + 1}
				class="top-0"
			/>
		{/each}
	{/if}
{/snippet}

{#snippet audioOutlets()}
	<!-- Audio output -->
	<StandardHandle
		port="outlet"
		type="audio"
		id="audio-out"
		title="Audio Output"
		total={1}
		index={0}
	/>
{/snippet}

<CommonExprLayout
	bind:this={layoutRef}
	{nodeId}
	{data}
	{selected}
	expr={data.expr}
	bind:isEditing
	placeholder="s * 0.5"
	editorClass="audio-expr-node-code-editor"
	displayPrefix="expr~"
	onExpressionChange={handleExpressionChange}
	handles={audioHandles}
	outlets={audioOutlets}
	onRun={handleRun}
	exitOnRun={false}
	runOnExit
/>

<style>
	:global(.audio-expr-node-code-editor .cm-content) {
		padding: 6px 8px 7px 4px !important;
	}
</style>
