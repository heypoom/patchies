<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EditorView, minimalSetup } from 'codemirror';
	import { Compartment, EditorState, Prec, type Extension } from '@codemirror/state';
	import { javascript } from '@codemirror/lang-javascript';
	import { python } from '@codemirror/lang-python';
	import { markdown } from '@codemirror/lang-markdown';
	import { tokyoNight } from '@uiw/codemirror-theme-tokyo-night';
	import { keymap, drawSelection } from '@codemirror/view';
	import { glslLanguage } from '$lib/codemirror/glsl.codemirror';
	import { LanguageSupport } from '@codemirror/language';
	import { vim, Vim } from '@replit/codemirror-vim';
	import { useVimInEditor } from '../../stores/editor.store';

	let languageComp = new Compartment();

	type SupportedLanguage = 'javascript' | 'glsl' | 'python' | 'markdown' | 'plain';

	let {
		value = $bindable(),
		language = 'javascript',
		placeholder = '',
		class: className = '',
		onrun = () => {},
		onchange = (code: string) => {},
		fontSize = '12px',
		extraExtensions = [],
		...restProps
	}: {
		value?: string;
		language?: SupportedLanguage;
		placeholder?: string;
		class?: string;
		onrun?: () => void;
		onchange?: (code: string) => void;
		extraExtensions?: Extension[];
		fontSize?: string;
	} = $props();

	let editorElement: HTMLDivElement;
	let editorView: EditorView | null = null;

	function getLanguageExtension(language: string) {
		if (language === 'javascript') {
			return javascript();
		} else if (language === 'glsl') {
			return new LanguageSupport(glslLanguage);
		} else if (language === 'python') {
			return python();
		} else if (language === 'markdown') {
			return markdown();
		}

		return [];
	}

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
				drawSelection(),
				minimalSetup,

				tokyoNight,

				languageComp.of(getLanguageExtension(language)),

				EditorView.theme({
					'&': {
						fontSize,
						fontFamily: 'Monaco, Menlo, Ubuntu Mono, Consolas, source-code-pro, monospace'
					},
					'.cm-content': {
						padding: '12px',
						minHeight: '100%',
						maxHeight: '1000px',
						color: 'rgb(244 244 245)'
					},
					'.cm-focused': {
						outline: 'none'
					},
					'.cm-editor': {
						borderRadius: '6px',
						border: '1px solid rgb(63 63 70)'
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
					},
					'.cm-selectionBackground': {
						backgroundColor: 'rgba(59, 130, 246, 0.3)'
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

			if ($useVimInEditor) {
				Vim.defineEx('write', 'w', onrun);

				extensions.push(drawSelection());
				extensions.push(vim({ status: false }));
			}

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

	// Sync language extension with the `language` prop
	$effect(() => {
		editorView?.dispatch({
			effects: languageComp.reconfigure(getLanguageExtension(language))
		});
	});
</script>

<div
	bind:this={editorElement}
	class={['code-editor-container outline-none', className]}
	{...restProps}
></div>

<style>
	.code-editor-container {
		width: 100%;
		height: 100%;
	}

	/* Additional dark theme customizations */
	:global(.code-editor-container .cm-editor) {
		height: 100%;
		background: transparent !important;
	}

	:global(.code-editor-container .cm-content) {
		background: transparent !important;
		color: rgb(244 244 245) !important;
	}

	:global(.code-editor-container .cm-gutters) {
		background: transparent !important;
		border-right: 1px solid transparent !important;
		color: rgb(115 115 115) !important;
	}

	:global(.code-editor-container .cm-activeLine) {
		background: rgba(255, 255, 255, 0.05) !important;
	}

	:global(.code-editor-container .cm-activeLineGutter) {
		background: rgba(255, 255, 255, 0.05) !important;
	}

	:global(.code-editor-container .cm-cursor) {
		border-left-color: rgb(244 244 245) !important;
	}
</style>
