<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { AudioSystem } from '$lib/audio/AudioSystem';
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

	const messageContext = new MessageContext(nodeId);
	let audioSystem = AudioSystem.getInstance();
	let layoutRef = $state<any>();

	// Handle incoming messages
	const handleMessage: MessageCallbackFn = (message, meta) => {
		// For audio expression nodes, we could handle control messages
		// that modify the expression or its parameters
		match(message)
			.with({ type: 'bang' }, () => {
				// Bang could trigger re-evaluation or reset
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

	function handleExpressionChange(newExpr: string) {
		expr = newExpr;
		updateAudioExpression(newExpr);
	}

	onMount(() => {
		messageContext.queue.addCallback(handleMessage);

		// Create the audio expression node
		audioSystem.createAudioObject(nodeId, 'expr~', [null, expr]);

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
	<!-- Audio input -->
	<Handle
		type="target"
		position={Position.Top}
		class="z-1 top-0 !bg-blue-500"
		title="Audio Input"
	/>
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
