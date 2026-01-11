<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EditorView, minimalSetup } from 'codemirror';
	import { Compartment, EditorState, Prec, type Extension } from '@codemirror/state';
	import { tokyoNight } from '@uiw/codemirror-theme-tokyo-night';
	import { keymap, drawSelection, Decoration, type DecorationSet } from '@codemirror/view';
	import { StateField, StateEffect } from '@codemirror/state';
	import { useVimInEditor } from '../../stores/editor.store';
	import { loadLanguageExtension } from '$lib/codemirror/language';
	import { autocompletion, acceptCompletion, completionStatus } from '@codemirror/autocomplete';
	import { indentMore } from '@codemirror/commands';
	import { search, searchKeymap } from '@codemirror/search';

	// Effect to set the error line
	const setErrorLineEffect = StateEffect.define<number | null>();

	// StateField to manage error line decorations
	const errorLineField = StateField.define<DecorationSet>({
		create() {
			return Decoration.none;
		},
		update(decorations, tr) {
			decorations = decorations.map(tr.changes);
			for (let effect of tr.effects) {
				if (effect.is(setErrorLineEffect)) {
					if (effect.value === null) {
						decorations = Decoration.none;
					} else {
						const line = tr.state.doc.line(effect.value);
						const decoration = Decoration.line({ class: 'cm-errorLine' });
						decorations = Decoration.set([decoration.range(line.from)]);
					}
				}
			}
			return decorations;
		},
		provide: (f) => EditorView.decorations.from(f)
	});

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
		errorLine,
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
		errorLine?: number;
	} = $props();

	let editorElement: HTMLDivElement;
	let editorView: EditorView | null = $state(null);
	let isInternalUpdate = false; // Flag to prevent loops when user types

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

				// Error line highlighting
				errorLineField,

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
					},
					'.cm-errorLine': {
						backgroundColor: 'rgba(239, 68, 68, 0.15)',
						borderLeft: '3px solid rgb(239 68 68)'
					},
					'.cm-errorLineGutter': {
						backgroundColor: 'rgba(239, 68, 68, 0.2)'
					}
				}),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						const updatedValue = update.state.doc.toString();

						// Set flag to prevent the $effect from triggering on user input
						isInternalUpdate = true;

						if (onchange) {
							onchange(updatedValue);
						} else {
							value = updatedValue;
						}

						// Reset flag after microtask to allow external updates
						queueMicrotask(() => {
							isInternalUpdate = false;
						});
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
				doc: value ?? '',
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
	// We need to read 'value' at the start to make it a tracked dependency
	$effect(() => {
		const newValue = value ?? '';

		// Only update if editor is mounted
		if (!editorView) return;

		// Skip update if the change came from the editor itself (user typing)
		// This prevents unnecessary XYFlow updates on every keystroke
		if (isInternalUpdate) return;

		const currentDoc = editorView.state.doc.toString();

		// Only dispatch if the values are actually different
		if (currentDoc !== newValue) {
			editorView.dispatch({
				changes: {
					from: 0,
					to: editorView.state.doc.length,
					insert: newValue
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

	// Highlight error line when errorLine prop or editorView changes
	$effect(() => {
		// React to both errorLine and editorView changes
		if (!editorView) return;

		// Validate error line is within document bounds
		const lineCount = editorView.state.doc.lines;

		const validErrorLine = errorLine && errorLine > 0 && errorLine <= lineCount ? errorLine : null;

		// Dispatch effect to set or clear error line
		editorView.dispatch({
			effects: [
				setErrorLineEffect.of(validErrorLine),
				...(validErrorLine
					? [
							EditorView.scrollIntoView(editorView.state.doc.line(validErrorLine).from, {
								y: 'center'
							})
						]
					: [])
			]
		});
	});
</script>

<div
	bind:this={editorElement}
	class={['code-editor-container nodrag nopan nowheel outline-none', className]}
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
