<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { AudioSystem } from '$lib/audio/AudioSystem';
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
	let expr = $state(data.expr || '');
	let inletValues = $state<number[]>([]);

	const messageContext = new MessageContext(nodeId);
	let audioSystem = AudioSystem.getInstance();
	let layoutRef = $state<any>();

	const inletCount = $derived.by(() => {
		if (!expr.trim()) return 0;

		return parseInletCount(expr.trim());
	});

	// Handle incoming messages
	const handleMessage: MessageCallbackFn = (message, meta) => {
		const nextInletValues = [...inletValues];

		match(message)
			.with(P.union(P.number), (value) => {
				if (meta?.inlet === undefined) return;

				nextInletValues[meta.inlet] = value;
				inletValues = nextInletValues;

				// Send updated inlet values to the audio processor
				updateAudioInletValues(nextInletValues);
			})
			.with(P.string, (newExpr) => {
				// String messages could update the expression
				expr = newExpr;
				updateAudioExpression(newExpr);
			});
	};

	function updateAudioExpression(expression: string) {
		// Send the expression to the audio system
		audioSystem.handleAudioMessage(nodeId, 'expression', expression);
	}

	function updateAudioInletValues(values: number[]) {
		// Send inlet values to the audio system
		audioSystem.handleAudioMessage(nodeId, 'inletValues', values);
	}

	function handleExpressionChange(newExpr: string) {
		expr = newExpr;
		updateAudioExpression(newExpr);

		// Update inlet count when expression changes
		const newInletCount = parseInletCount(newExpr || '');

		if (newInletCount !== inletValues.length) {
			inletValues = new Array(newInletCount).fill(0);
			updateAudioInletValues(inletValues);
		}
	}

	onMount(() => {
		messageContext.queue.addCallback(handleMessage);

		// Initialize inlet values array
		inletValues = new Array(inletCount).fill(0);

		// Create the audio expression node
		audioSystem.createAudioObject(nodeId, 'expr~', [null, expr]);

		// Send initial inlet values
		updateAudioInletValues(inletValues);

		// Focus editor if starting in editing mode
		if (isEditing) {
			setTimeout(() => layoutRef?.focus(), 10);
		}
	});

	onDestroy(() => {
		messageContext.queue.removeCallback(handleMessage);
		messageContext.destroy();
		audioSystem.removeAudioObject(nodeId);
	});
</script>

{#snippet audioHandles()}
	<!-- Total inlets = 1 audio inlet + control inlets -->
	{@const totalInlets = 1 + inletCount}

	<!-- Audio input (always present) -->
	<Handle
		type="target"
		position={Position.Top}
		class="z-1 top-0 !bg-blue-500"
		style={`left: ${inletCount === 0 ? '50%' : `${35 + (0 / (totalInlets - 1)) * 30}%`}`}
		title="Audio Input"
		id="inlet-audio"
	/>

	<!-- Control inlets for $1-$9 variables (only show if there are $ variables) -->
	{#if inletCount > 0}
		{#each Array.from({ length: inletCount }) as _, index}
			<Handle
				type="target"
				position={Position.Top}
				id={`inlet-${index}`}
				class="z-1 top-0"
				style={`left: ${35 + ((index + 1) / (totalInlets - 1)) * 30}%`}
				title={`$${index + 1}`}
			/>
		{/each}
	{/if}
{/snippet}

{#snippet audioOutlets()}
	<!-- Audio output -->
	<Handle type="source" position={Position.Bottom} class="z-1 !bg-blue-500" title="Audio Output" />
{/snippet}

<CommonExprLayout
	bind:this={layoutRef}
	{nodeId}
	{data}
	{selected}
	bind:expr
	bind:isEditing
	placeholder="sample * 0.5"
	editorClass="audio-expr-node-code-editor"
	displayPrefix="expr~"
	onExpressionChange={handleExpressionChange}
	handles={audioHandles}
	outlets={audioOutlets}
/>

<style>
	:global(.audio-expr-node-code-editor .cm-content) {
		padding: 6px 8px 7px 4px !important;
	}
</style>
