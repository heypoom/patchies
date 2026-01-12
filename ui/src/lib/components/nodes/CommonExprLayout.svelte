<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import hljs from 'highlight.js/lib/core';
	import javascript from 'highlight.js/lib/languages/javascript';
	import CodeEditor from '../CodeEditor.svelte';
	import { keymap } from '@codemirror/view';
	import { EditorView } from 'codemirror';

	import 'highlight.js/styles/tokyo-night-dark.css';

	hljs.registerLanguage('javascript', javascript);

	let {
		nodeId,
		data,
		selected,
		expr = $bindable(),
		isEditing = $bindable(),
		placeholder = 'expr',
		displayPrefix,
		editorClass = 'common-expr-node-code-editor',
		onExpressionChange = () => {},
		onRun = () => {},
		exitOnRun = true,
		runOnExit = false,
		extraExtensions = [],
		hasError = false,
		children,
		handles,
		outlets
	}: {
		nodeId: string;
		data: any;
		selected: boolean;
		expr: string;
		isEditing: boolean;
		placeholder?: string;
		displayPrefix?: string;
		editorClass?: string;
		onRun?: () => void;
		onExpressionChange?: (expr: string) => void;
		exitOnRun?: boolean;
		runOnExit?: boolean;
		extraExtensions?: any[];
		hasError?: boolean;
		children?: any;
		handles?: any;
		outlets?: any;
	} = $props();

	const { updateNodeData, deleteElements } = useSvelteFlow();

	let originalExpr = expr; // Store original for escape functionality

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

	function enterEditingMode() {
		isEditing = true;
		originalExpr = expr;

		focusEditor();
	}

	function focusEditor() {
		setTimeout(() => {
			const editor = document.querySelector(`.${editorClass} .cm-content`) as HTMLElement;
			editor?.focus();
		}, 10);
	}

	function exitEditingMode(save: boolean = true) {
		isEditing = false;

		if (runOnExit) {
			onRun?.();
		}

		if (!save) {
			// Restore original expression on escape
			expr = originalExpr;
			updateNodeData(nodeId, { expr: originalExpr });
			onExpressionChange(originalExpr);

			// If the original expression was empty, delete the node
			if (!originalExpr.trim()) {
				deleteElements({ nodes: [{ id: nodeId }] });
				return;
			}
		}

		if (save) {
			if (expr.trim()) {
				const trimmedExpr = expr.trim();
				updateNodeData(nodeId, { expr: trimmedExpr });
				onExpressionChange(trimmedExpr);
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

	function handleExpressionUpdate(value: string) {
		expr = value;
		updateNodeData(nodeId, { expr: value });
		onExpressionChange(value);
	}

	const containerClass = $derived.by(() => {
		if (hasError) return '!border-red-500 object-container';

		return selected ? 'object-container-selected' : 'object-container';
	});

	export function focus() {
		if (isEditing) {
			focusEditor();
		}
	}
</script>

<div class="relative">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="relative">
				{@render handles?.()}

				<div class="relative">
					{#if isEditing}
						<div
							class={[
								'expr-editor-container nodrag w-full max-w-[400px] min-w-[40px] resize-none rounded-lg border font-mono text-zinc-200',
								containerClass
							]}
						>
							<CodeEditor
								value={expr}
								onchange={handleExpressionUpdate}
								onrun={() => {
									if (exitOnRun) exitEditingMode(true);

									onRun?.();
								}}
								language="javascript"
								class={`${editorClass} rounded-lg border !border-transparent focus:outline-none`}
								{placeholder}
								nodeType="expr"
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
									}),
									...extraExtensions
								]}
							/>
						</div>
					{:else}
						<div
							ondblclick={handleDoubleClick}
							class={[
								'expr-display cursor-pointer rounded-lg border px-3 py-2 text-start text-xs font-medium text-zinc-200 hover:bg-zinc-800',
								containerClass
							]}
							role="button"
							tabindex="0"
							onkeydown={(e) => e.key === 'Enter' && handleDoubleClick()}
						>
							<div class="expr-preview flex items-center gap-2 font-mono">
								{#if expr}
									<span class="flex max-w-[400px] overflow-hidden">
										{#if displayPrefix}
											<span class="mr-2 text-xs text-zinc-400">{displayPrefix}</span>
										{/if}

										<code class="text-xs whitespace-pre">
											{@html highlightedHtml}
										</code>
									</span>
								{/if}
							</div>
						</div>
					{/if}
				</div>

				{@render outlets?.()}
			</div>
		</div>
	</div>
</div>

<style>
	:global(.common-expr-node-code-editor .cm-content) {
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
