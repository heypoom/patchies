<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EditorView, basicSetup, minimalSetup } from 'codemirror';
	import { EditorState, Prec, type Extension } from '@codemirror/state';
	import { javascript } from '@codemirror/lang-javascript';
	import { oneDark } from '@codemirror/theme-one-dark';
	import { keymap } from '@codemirror/view';

	let {
		value = $bindable(),
		language = 'javascript',
		placeholder = '',
		class: className = '',
		onrun = () => {},
		onchange = (code: string) => {},
		fontSize = '14px',
		extraExtensions = [],
		...restProps
	}: {
		value?: string;
		language?: string;
		placeholder?: string;
		class?: string;
		onrun?: () => void;
		onchange?: (code: string) => void;
		extraExtensions?: Extension[];
		fontSize?: string;
	} = $props();

	let editorElement: HTMLDivElement;
	let editorView: EditorView | null = null;

	onMount(() => {
		if (editorElement) {
			const extensions = [
				Prec.highest(
					keymap.of([
						{
							key: 'Shift-Enter',
							run: () => {
								onrun();
								return true;
							}
						}
					])
				),

				minimalSetup,
				javascript(),
				oneDark,

				EditorView.theme({
					'&': {
						fontSize,
						fontFamily: 'Monaco, Menlo, Ubuntu Mono, Consolas, source-code-pro, monospace'
					},
					'.cm-content': {
						padding: '12px',
						minHeight: '100%',
						backgroundColor: 'rgb(24 24 27)',
						color: 'rgb(244 244 245)'
					},
					'.cm-focused': {
						outline: 'none'
					},
					'.cm-editor': {
						borderRadius: '6px',
						border: '1px solid rgb(63 63 70)',
						backgroundColor: 'rgb(24 24 27)'
					},
					'.cm-editor.cm-focused': {
						borderColor: 'rgb(59 130 246)',
						boxShadow: '0 0 0 1px rgb(59 130 246)'
					},
					'.cm-scroller': {
						fontFamily: 'inherit'
					},
					'.cm-placeholder': {
						color: 'rgb(115 115 115)'
					}
				}),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						const updatedValue = update.state.doc.toString();

						if (onchange) {
							onchange(updatedValue);
							return;
						}

						value = updatedValue;
					}
				}),
				...extraExtensions
			];

			// Add placeholder if provided
			if (placeholder) {
				extensions.push(
					EditorState.transactionExtender.of(() => {
						return {
							effects: EditorView.announce.of(placeholder)
						};
					})
				);
			}

			const state = EditorState.create({
				doc: value,
				extensions
			});

			editorView = new EditorView({
				state,
				parent: editorElement
			});
		}
	});

	onDestroy(() => {
		if (editorView) {
			editorView.destroy();
		}
	});

	// Update editor when value prop changes externally
	$effect(() => {
		if (editorView && editorView.state.doc.toString() !== value) {
			editorView.dispatch({
				changes: {
					from: 0,
					to: editorView.state.doc.length,
					insert: value
				}
			});
		}
	});
</script>

<div bind:this={editorElement} class="code-editor-container {className}" {...restProps}></div>

<style>
	.code-editor-container {
		width: 100%;
		height: 100%;
	}

	/* Additional dark theme customizations */
	:global(.code-editor-container .cm-editor) {
		height: 100%;
		background: rgb(24 24 27) !important;
	}

	:global(.code-editor-container .cm-content) {
		background: rgb(24 24 27) !important;
		color: rgb(244 244 245) !important;
	}

	:global(.code-editor-container .cm-gutters) {
		background: rgb(24 24 27) !important;
		border-right: 1px solid rgb(63 63 70) !important;
		color: rgb(115 115 115) !important;
	}

	:global(.code-editor-container .cm-activeLine) {
		background: rgba(255, 255, 255, 0.05) !important;
	}

	:global(.code-editor-container .cm-activeLineGutter) {
		background: rgba(255, 255, 255, 0.05) !important;
	}

	:global(.code-editor-container .cm-selectionBackground) {
		background: rgba(59, 130, 246, 0.3) !important;
	}

	:global(.code-editor-container .cm-cursor) {
		border-left-color: rgb(244 244 245) !important;
	}
</style>
