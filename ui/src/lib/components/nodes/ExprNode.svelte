<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import hljs from 'highlight.js/lib/core';
	import javascript from 'highlight.js/lib/languages/javascript';
	import CodeEditor from '../CodeEditor.svelte';
	import { keymap } from '@codemirror/view';
	import { EditorView } from 'codemirror';
	import { parseInletCount, createExpressionEvaluator } from '$lib/utils/expr-parser';

	import 'highlight.js/styles/tokyo-night-dark.css';

	hljs.registerLanguage('javascript', javascript);

	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: { expr: string; inletCount: number };
		selected: boolean;
	} = $props();

	const { updateNodeData, deleteElements } = useSvelteFlow();

	let isEditing = $state(!data.expr); // Start in editing mode if no expression
	let expr = $derived(data.expr || '');
	let originalExpr = data.expr || ''; // Store original for escape functionality
	let inletValues = $state<number[]>([]);

	const messageContext = new MessageContext(nodeId);

	const inletCount = $derived.by(() => {
		if (!expr.trim()) return 1;
		return parseInletCount(expr.trim());
	});

	let highlightedHtml = $derived.by(() => {
		if (!expr) return '';

		try {
			return hljs.highlight(expr, {
				language: 'javascript',
				ignoreIllegals: true
			}).value;
		} catch (e) {
			return '';
		}
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

	function enterEditingMode() {
		isEditing = true;
		originalExpr = expr;

		focusEditor();
	}

	function focusEditor() {
		setTimeout(() => {
			const editor = document.querySelector('.expr-node-code-editor .cm-content') as HTMLElement;

			editor?.focus();
		}, 10);
	}

	function exitEditingMode(save: boolean = true) {
		isEditing = false;

		if (!save) {
			// Restore original expression on escape
			const restored = originalExpr;
			updateNodeData(nodeId, { ...data, expr: restored });

			// If the original expression was empty, delete the node
			if (!originalExpr.trim()) {
				deleteElements({ nodes: [{ id: nodeId }] });
				return;
			}
		}

		if (save) {
			if (expr.trim()) {
				updateNodeData(nodeId, {
					...data,
					expr: expr.trim(),
					inletCount: parseInletCount(expr.trim())
				});
			} else {
				// If trying to save with empty expression, delete the node
				deleteElements({ nodes: [{ id: nodeId }] });
			}
		}
	}

	function handleDoubleClick() {
		if (!isEditing) {
			enterEditingMode();
		}
	}

	const borderColor = $derived(selected ? 'border-zinc-400' : 'border-zinc-700');

	onMount(() => {
		messageContext.queue.addCallback(handleMessage);

		// Initialize inlet values array
		inletValues = new Array(inletCount).fill(0);

		// Focus editor if starting in editing mode
		if (isEditing) {
			focusEditor();
		}
	});

	onDestroy(() => {
		messageContext.queue.removeCallback(handleMessage);
		messageContext.destroy();
	});
</script>

<div class="relative">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="relative">
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

				<div class="relative">
					{#if isEditing}
						<div
							class={[
								'nodrag w-full min-w-[40px] max-w-[200px] resize-none rounded-lg border bg-zinc-900 font-mono text-zinc-200',
								borderColor
							]}
						>
							<CodeEditor
								value={expr}
								onchange={(value) =>
									updateNodeData(nodeId, {
										...data,
										expr: value,
										inletCount: parseInletCount(value || '')
									})}
								onrun={() => exitEditingMode(true)}
								language="javascript"
								class="expr-node-code-editor rounded-lg border !border-transparent focus:outline-none"
								placeholder="$1 + 2"
								extraExtensions={[
									keymap.of([
										{
											key: 'Escape',
											run: () => {
												exitEditingMode(false);
												return true;
											}
										}
									]),
									EditorView.focusChangeEffect.of((_, focusing) => {
										if (!focusing) {
											// Delay to allow other events to process first
											setTimeout(() => exitEditingMode(true), 100);
										}
										return null;
									})
								]}
							/>
						</div>
					{:else}
						<div
							ondblclick={handleDoubleClick}
							class={[
								'expr-display max-w-[200px] cursor-pointer rounded-lg border bg-zinc-900 px-3 py-2 text-start text-xs font-medium text-zinc-200 hover:bg-zinc-800',
								borderColor
							]}
							role="button"
							tabindex="0"
							onkeydown={(e) => e.key === 'Enter' && handleDoubleClick()}
						>
							{#if expr}
								<code class="whitespace-pre-wrap">
									{@html highlightedHtml}
								</code>
							{:else}
								<span class="text-zinc-500">expr</span>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Single outlet -->
				<Handle type="source" position={Position.Bottom} class="z-1" title="Result" />
			</div>
		</div>
	</div>
</div>

<style>
	:global(.expr-node-code-editor .cm-content) {
		padding: 6px 8px 7px 4px !important;
	}

	.expr-display {
		font-family:
			Monaco,
			Menlo,
			Ubuntu Mono,
			Consolas,
			source-code-pro,
			monospace;
	}
</style>
