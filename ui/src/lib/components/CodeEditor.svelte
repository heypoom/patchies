<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EditorView, minimalSetup } from 'codemirror';
	import { Compartment, EditorState, Prec, type Extension } from '@codemirror/state';
	import { tokyoNight } from '@uiw/codemirror-theme-tokyo-night';
	import { keymap, drawSelection } from '@codemirror/view';
	import { useVimInEditor } from '../../stores/editor.store';
	import { loadLanguageExtension } from '$lib/codemirror/language';
	import { autocompletion, acceptCompletion, completionStatus } from '@codemirror/autocomplete';
	import { indentMore } from '@codemirror/commands';
	import { search, searchKeymap } from '@codemirror/search';

	let languageComp = new Compartment();

	type SupportedLanguage = 'javascript' | 'glsl' | 'python' | 'markdown' | 'plain' | 'assembly';

	let {
		value = $bindable(),
		language = 'javascript',
		placeholder = '',
		class: className = '',
		onrun = () => {},
		onchange = (code: string) => {},
		fontSize = '12px',
		extraExtensions = [],
		onready,
		nodeType,
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
		onready?: () => void;
		nodeType?: string;
	} = $props();

	let editorElement: HTMLDivElement;
	let editorView: EditorView | null = null;

	onMount(async () => {
		if (editorElement) {
			const languageExtension = await loadLanguageExtension(language, { nodeType });

			const extensions = [
				keymap.of(searchKeymap),
				Prec.highest(
					keymap.of([
						{
							key: 'Shift-Enter',
							run: () => {
								onrun();
								return true;
							}
						},
						{
							key: 'Tab',
							run: (view) => {
								// Accept completion if one is active, otherwise indent
								if (completionStatus(view.state) === 'active') {
									return acceptCompletion(view);
								}

								return indentMore(view);
							}
						}
					])
				),
				drawSelection(),
				minimalSetup,

				tokyoNight,

				search(),

				languageComp.of(languageExtension),

				// Prevent wheel events from bubbling to XYFlow
				EditorView.domEventHandlers({
					wheel: (event) => {
						event.stopPropagation();
					}
				}),

				EditorView.theme({
					'&': {
						fontSize,
						fontFamily: 'Monaco, Menlo, Ubuntu Mono, Consolas, source-code-pro, monospace'
					},
					'.cm-content': {
						padding: '12px',
						minHeight: '100%',
						maxHeight: '500px',
						maxWidth: '500px',
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
				autocompletion(),
				...extraExtensions
			];

			if ($useVimInEditor) {
				const { vim, Vim } = await import('@replit/codemirror-vim');
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

			onready?.();
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
		loadLanguageExtension(language, { nodeType }).then((languageExtension) => {
			if (editorView) {
				editorView.dispatch({
					effects: languageComp.reconfigure(languageExtension)
				});
			}
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
		min-width: 50px;
		min-height: 25px;
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
