<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { parseInletCount, createExpressionEvaluator } from '$lib/utils/expr-parser';
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
	let expr = $state(data.expr || '');
	let inletValues = $state<number[]>([]);
	let layoutRef = $state<any>();

	const messageContext = new MessageContext(nodeId);

	const inletCount = $derived.by(() => {
		if (!expr.trim()) return 1;

		return parseInletCount(expr.trim());
	});

	const evalFunction = $derived.by(() => createExpressionEvaluator(expr));

	// Handle incoming messages
	const handleMessage: MessageCallbackFn = (message, meta) => {
		const nextInletValues = [...inletValues];

		match(message)
			.with({ type: 'bang' }, () => {})
			.with(P.union(P.number), (value) => {
				if (meta?.inlet === undefined) return;

				nextInletValues[meta.inlet] = value;
				inletValues = nextInletValues;
			});

		// Evaluate expression and send result
		if (evalFunction) {
			try {
				const args = [...Array(9)].map((_, i) => nextInletValues[i] ?? 0);
				const result = evalFunction(...args);

				messageContext.send(result);
			} catch (error) {
				console.error(`Expression evaluation error in ${nodeId}:`, error);
			}
		}
	};

	function handleExpressionChange(newExpr: string) {
		expr = newExpr;
		// Update inlet count when expression changes
		const newInletCount = parseInletCount(newExpr || '');
		if (newInletCount !== inletValues.length) {
			inletValues = new Array(newInletCount).fill(0);
		}
	}

	onMount(() => {
		messageContext.queue.addCallback(handleMessage);

		// Initialize inlet values array
		inletValues = new Array(inletCount).fill(0);

		// Focus editor if starting in editing mode
		if (isEditing) {
			setTimeout(() => layoutRef?.focus(), 10);
		}
	});

	onDestroy(() => {
		messageContext.queue.removeCallback(handleMessage);
		messageContext.destroy();
	});
</script>

{#snippet exprHandles()}
	<!-- Dynamic inlets based on expression -->
	{#each Array.from({ length: inletCount }) as _, index}
		<Handle
			type="target"
			position={Position.Top}
			id={`inlet-${index}`}
			class="z-1 top-0"
			style={`left: ${inletCount === 1 ? '50%' : `${35 + (index / (inletCount - 1)) * 30}%`}`}
			title={`$${index + 1}`}
		/>
	{/each}
{/snippet}

{#snippet exprOutlets()}
	<!-- Single outlet -->
	<Handle type="source" position={Position.Bottom} class="z-1" title="Result" />
{/snippet}

<CommonExprLayout
	bind:this={layoutRef}
	{nodeId}
	{data}
	{selected}
	bind:expr
	bind:isEditing
	placeholder="$1 + 2"
	displayPrefix="expr"
	editorClass="expr-node-code-editor"
	onExpressionChange={handleExpressionChange}
	handles={exprHandles}
	outlets={exprOutlets}
/>

<style>
	:global(.expr-node-code-editor .cm-content) {
		padding: 6px 8px 7px 4px !important;
	}
</style>
