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

	let isEditing = $state(!data.expr);
	let expr = $state(data.expr || '');
	let isRunning = $state(false);
	let layoutRef = $state<any>();

	let messageContext: MessageContext;
	let audioSystem = AudioSystem.getInstance();

	const handleMessage: MessageCallbackFn = (message) => {
		match(message)
			.with(P.string, async (nextExpr) => {
				expr = nextExpr;

				if (isRunning && nextExpr.trim()) {
					await runChuckCode(nextExpr);
				}
			})
			.with({ type: 'bang' }, async () => {
				if (!expr.trim()) return;

				await runChuckCode(expr);
			})
			.with({ type: 'stop' }, () => {
				stopChuck();
			});
	};

	async function runChuckCode(code: string) {
		if (!code.trim()) return;

		try {
			isRunning = true;
			audioSystem.sendControlMessage(nodeId, 'code', code);
		} catch (error) {
			console.error('ChucK code error:', error);
			isRunning = false;
		}
	}

	function stopChuck() {
		try {
			audioSystem.sendControlMessage(nodeId, 'stop', null);
			isRunning = false;
		} catch (error) {
			console.error('Failed to stop ChucK:', error);
		}
	}

	function handleExpressionChange(newExpr: string) {
		expr = newExpr;
	}

	async function handleRun() {
		if (!expr.trim()) return;

		await runChuckCode(expr);
	}

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);
		audioSystem.createAudioObject(nodeId, 'chuck');
		runChuckCode(data.expr);

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

{#snippet chuckHandles()}
	<!-- Control inlet for messages and code -->
	<Handle
		type="target"
		position={Position.Top}
		class="z-1 top-0"
		style="left: 50%"
		title="Control Input (code, bang, stop)"
		id="inlet-0"
	/>
{/snippet}

{#snippet chuckOutlets()}
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
	placeholder="SinOsc osc => dac; 1::second => now;"
	editorClass="chuck-node-code-editor"
	onExpressionChange={handleExpressionChange}
	handles={chuckHandles}
	outlets={chuckOutlets}
>
	{#if !isEditing && expr}
		<div class="mt-2 flex gap-1">
			<button
				onclick={handleRun}
				class="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
				disabled={isRunning}
			>
				{isRunning ? 'Running...' : 'Run'}
			</button>

			<button
				onclick={stopChuck}
				class="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
				disabled={!isRunning}
			>
				Stop
			</button>
		</div>
	{/if}
</CommonExprLayout>

<style>
	:global(.chuck-node-code-editor .cm-content) {
		padding: 6px 8px 7px 4px !important;
	}
</style>
