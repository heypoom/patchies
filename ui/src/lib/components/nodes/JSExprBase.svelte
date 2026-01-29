<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { useSvelteFlow } from '@xyflow/svelte';
	import { Terminal } from '@lucide/svelte/icons';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import VirtualConsole from '$lib/components/VirtualConsole.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match } from 'ts-pattern';
	import { parseInletCount } from '$lib/utils/expr-parser';
	import CommonExprLayout from './CommonExprLayout.svelte';
	import { createCustomConsole } from '$lib/utils/createCustomConsole';
	import { JSRunner } from '$lib/js-runner/JSRunner';

	type SendFn = (msg: unknown, options?: { to?: number }) => void;

	type ResultHandler = (result: unknown, originalMessage: unknown, send: SendFn) => void;

	let {
		id: nodeId,
		data,
		selected,
		displayPrefix,
		placeholder,
		outletTitles = ['Output'],
		requireAllInlets = false,
		onResult
	}: {
		id: string;
		data: { expr: string; showConsole?: boolean };
		selected: boolean;
		displayPrefix: string;
		placeholder: string;
		outletTitles?: string[];
		requireAllInlets?: boolean;
		onResult: ResultHandler;
	} = $props();

	let isEditing = $state(!data.expr);
	let expr = $state(data.expr || '');
	let inletValues = $state<unknown[]>([]);
	let populatedInlets = $state(new Set<number>());
	let hasError = $state(false);
	let layoutRef = $state<CommonExprLayout | null>(null);
	let consoleRef: VirtualConsole | null = $state(null);

	const { updateNodeData } = useSvelteFlow();
	const messageContext = new MessageContext(nodeId);
	const customConsole = createCustomConsole(nodeId);
	const jsRunner = JSRunner.getInstance();

	function toggleConsole() {
		data.showConsole = !data.showConsole;
		updateNodeData(nodeId, { showConsole: data.showConsole });
	}

	const inletCount = $derived.by(() => {
		if (!expr.trim()) return 1;
		return Math.max(1, parseInletCount(expr.trim()));
	});

	/**
	 * Evaluate the JS expression using JSRunner
	 */
	async function evaluate(
		values: unknown[]
	): Promise<{ success: true; result: unknown } | { success: false }> {
		if (!expr.trim()) return { success: true, result: values[0] };

		try {
			const extraContext: Record<string, unknown> = {};
			for (let i = 0; i < 9; i++) {
				extraContext[`$${i + 1}`] = values[i];
			}

			const code = `return (${expr})`;

			const result = await jsRunner.executeJavaScript(nodeId, code, {
				customConsole,
				skipMessageContext: true,
				extraContext
			});

			hasError = false;
			return { success: true, result };
		} catch (error) {
			hasError = true;
			customConsole.error(error instanceof Error ? error.message : String(error));
			return { success: false };
		}
	}

	const handleMessage: MessageCallbackFn = (message, meta) => {
		const inlet = meta?.inlet ?? 0;
		const nextInletValues = [...inletValues];

		match(message)
			.with({ type: 'bang' }, () => {})
			.otherwise((value) => {
				nextInletValues[inlet] = value;
				inletValues = nextInletValues;
				populatedInlets = new Set([...populatedInlets, inlet]);
			});

		// Only inlet 0 (hot) triggers evaluation
		if (inlet !== 0) return;

		// If requireAllInlets is set, check all inlets have received values
		if (requireAllInlets && inletCount > 1) {
			const allPopulated = Array.from({ length: inletCount }, (_, i) => i).every((i) =>
				populatedInlets.has(i)
			);
			if (!allPopulated) return;
		}

		evaluate(nextInletValues).then((evalResult) => {
			if (evalResult.success) {
				onResult(evalResult.result, message, (msg, options) => messageContext.send(msg, options));
			}
		});
	};

	function handleExpressionChange(newExpr: string) {
		data.expr = newExpr;
	}

	function handleRun() {
		consoleRef?.clearConsole();
		expr = data.expr;

		if (expr.trim()) {
			// Only do syntax validation - don't execute with undefined values
			// Runtime errors (like accessing .type on undefined) are expected and OK
			try {
				new Function('$1', '$2', '$3', '$4', '$5', '$6', '$7', '$8', '$9', `return (${expr})`);
				hasError = false;
			} catch (error) {
				hasError = true;
				customConsole.error(error instanceof Error ? error.message : String(error));
			}
		} else {
			hasError = false;
		}

		const newInletCount = parseInletCount(data.expr || '');
		if (newInletCount !== inletValues.length) {
			inletValues = new Array(newInletCount).fill(undefined);
			populatedInlets = new Set();
		}
	}

	export function focus() {
		layoutRef?.focus();
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

{#snippet handles()}
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

{#snippet outlets()}
	{#each outletTitles as title, index}
		<StandardHandle
			port="outlet"
			type="message"
			id={index}
			{title}
			total={outletTitles.length}
			{index}
			{nodeId}
		/>
	{/each}
{/snippet}

<div class="group relative flex flex-col gap-2">
	<div class="relative">
		<button
			class="absolute -top-6 right-0 z-10 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700"
			onclick={toggleConsole}
			title="Toggle console"
		>
			<Terminal class="h-3.5 w-3.5 text-zinc-400" />
		</button>

		<CommonExprLayout
			bind:this={layoutRef}
			{nodeId}
			{data}
			{selected}
			expr={data.expr}
			bind:isEditing
			{placeholder}
			{displayPrefix}
			editorClass="{displayPrefix}-node-code-editor"
			onExpressionChange={handleExpressionChange}
			{handles}
			{outlets}
			onRun={handleRun}
			exitOnRun={false}
			runOnExit
			{hasError}
		/>
	</div>

	<div class:hidden={!data.showConsole}>
		<VirtualConsole
			bind:this={consoleRef}
			{nodeId}
			placeholder="Errors will appear here."
			shouldAutoShowConsoleOnError
			shouldAutoHideConsoleOnNoError
		/>
	</div>
</div>

<style>
	:global(.filter-node-code-editor .cm-content),
	:global(.map-node-code-editor .cm-content),
	:global(.tap-node-code-editor .cm-content) {
		padding: 6px 8px 7px 4px !important;
	}
</style>
