<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { useSvelteFlow } from '@xyflow/svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import VirtualConsole from '$lib/components/VirtualConsole.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match } from 'ts-pattern';
	import { parseInletCount } from '$lib/utils/expr-parser';
	import CommonExprLayout from './CommonExprLayout.svelte';
	import { createCustomConsole } from '$lib/utils/createCustomConsole';
	import { JSRunner } from '$lib/js-runner/JSRunner';

	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: { expr: string; showConsole?: boolean };
		selected: boolean;
	} = $props();

	const { updateNodeData } = useSvelteFlow();

	let isEditing = $state(!data.expr);
	let expr = $state(data.expr || '');
	let inletValues = $state<unknown[]>([]);
	let hasError = $state(false);
	let layoutRef = $state<any>();
	let consoleRef: VirtualConsole | null = $state(null);

	const messageContext = new MessageContext(nodeId);
	const customConsole = createCustomConsole(nodeId);
	const jsRunner = JSRunner.getInstance();

	const inletCount = $derived.by(() => {
		if (!expr.trim()) return 1;
		return Math.max(1, parseInletCount(expr.trim()));
	});

	/**
	 * Evaluate the filter expression using JSRunner
	 * Returns true if the data should pass through, false otherwise
	 */
	async function evaluateFilter(values: unknown[]): Promise<boolean> {
		if (!expr.trim()) return true;

		try {
			// Build extraContext with $1-$9 variables
			const extraContext: Record<string, unknown> = {};
			for (let i = 0; i < 9; i++) {
				extraContext[`$${i + 1}`] = values[i];
			}

			// Wrap expression to return its value
			const code = `return (${expr})`;

			const result = await jsRunner.executeJavaScript(nodeId, code, {
				customConsole,
				skipMessageContext: true,
				extraContext
			});

			hasError = false;
			return Boolean(result);
		} catch (error) {
			hasError = true;
			customConsole.error(error instanceof Error ? error.message : String(error));
			return false;
		}
	}

	const handleMessage: MessageCallbackFn = (message, meta) => {
		const inlet = meta?.inlet ?? 0;
		const nextInletValues = [...inletValues];

		// Store value for this inlet
		match(message)
			.with({ type: 'bang' }, () => {})
			.otherwise((value) => {
				nextInletValues[inlet] = value;
				inletValues = nextInletValues;
			});

		// Only inlet 0 (hot) triggers evaluation
		if (inlet !== 0) return;

		// Evaluate filter and send if match (async)
		evaluateFilter(nextInletValues).then((shouldPass) => {
			if (shouldPass) {
				messageContext.send(message);
			}
		});
	};

	function handleExpressionChange(newExpr: string) {
		data.expr = newExpr;
	}

	async function handleRun() {
		consoleRef?.clearConsole();
		expr = data.expr;

		// Validate by trying to evaluate with dummy values
		if (expr.trim()) {
			try {
				const extraContext: Record<string, unknown> = {};
				for (let i = 0; i < 9; i++) {
					extraContext[`$${i + 1}`] = undefined;
				}

				await jsRunner.executeJavaScript(nodeId, `return (${expr})`, {
					customConsole,
					skipMessageContext: true,
					extraContext
				});
				hasError = false;
			} catch (error) {
				hasError = true;
				customConsole.error(error instanceof Error ? error.message : String(error));
			}
		} else {
			hasError = false;
		}

		// Update inlet count when expression changes
		const newInletCount = parseInletCount(data.expr || '');
		if (newInletCount !== inletValues.length) {
			inletValues = new Array(newInletCount).fill(undefined);
		}
	}

	onMount(() => {
		messageContext.queue.addCallback(handleMessage);
		inletValues = new Array(inletCount).fill(undefined);

		if (isEditing) {
			setTimeout(() => layoutRef?.focus(), 10);
		}
	});

	onDestroy(() => {
		messageContext.queue.removeCallback(handleMessage);
		messageContext.destroy();
	});
</script>

{#snippet filterHandles()}
	{#each Array.from({ length: inletCount }) as _, index}
		<StandardHandle
			port="inlet"
			type="message"
			id={index}
			title={`$${index + 1}`}
			total={inletCount}
			{index}
			class="top-0"
			{nodeId}
		/>
	{/each}
{/snippet}

{#snippet filterOutlets()}
	<StandardHandle port="outlet" type="message" title="Matched" total={1} index={0} {nodeId} />
{/snippet}

<div class="group relative flex flex-col gap-2">
	<CommonExprLayout
		bind:this={layoutRef}
		{nodeId}
		{data}
		{selected}
		expr={data.expr}
		bind:isEditing
		placeholder="$1.type === 'play'"
		displayPrefix="filter"
		editorClass="filter-node-code-editor"
		onExpressionChange={handleExpressionChange}
		handles={filterHandles}
		outlets={filterOutlets}
		onRun={handleRun}
		exitOnRun={false}
		runOnExit
		{hasError}
	/>

	<div class:hidden={!data.showConsole}>
		<VirtualConsole
			bind:this={consoleRef}
			{nodeId}
			placeholder="Filter errors will appear here."
			shouldAutoShowConsoleOnError
			shouldAutoHideConsoleOnNoError
		/>
	</div>
</div>

<style>
	:global(.filter-node-code-editor .cm-content) {
		padding: 6px 8px 7px 4px !important;
	}
</style>
