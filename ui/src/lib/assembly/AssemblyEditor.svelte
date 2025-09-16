<script lang="ts">
	import { EditorView, keymap } from '@codemirror/view';
	import { EditorState, Prec, type Extension } from '@codemirror/state';
	import { minimalSetup } from 'codemirror';
	import { tokyoNight } from '@uiw/codemirror-theme-tokyo-night';
	import { loadLanguageExtension } from '$lib/codemirror/language';
	import { onDestroy, onMount } from 'svelte';
	import { insertNewline } from '@codemirror/commands';

	interface Props {
		value: string;
		onchange?: (value: string) => void;
		onrun?: () => void;
		placeholder?: string;
		readonly?: boolean;
	}

	let {
		value = '',
		onchange,
		placeholder = 'Enter assembly code...',
		readonly = false,
		onrun
	}: Props = $props();

	let editorContainer = $state<HTMLDivElement>();
	let editorView: EditorView | null = null;
	let currentAssemblyExtension: Extension | null = null;

	async function createOrUpdateEditor() {
		const assemblyExtension = await loadLanguageExtension('assembly');

		if (!editorContainer) return;

		// If extension changed or no editor exists, recreate the editor
		if (!editorView || currentAssemblyExtension !== assemblyExtension) {
			if (editorView) {
				editorView.destroy();
			}

			currentAssemblyExtension = assemblyExtension;

			const asmKeymap = Prec.highest(
				keymap.of([
					{
						key: 'Shift-Enter',
						run: () => {
							onrun?.();
							return true;
						}
					},
					{
						key: 'Enter',
						run: (view) => {
							insertNewline(view);
							return true;
						}
					}
				])
			);

			const extensions = [
				asmKeymap,
				minimalSetup,
				tokyoNight,
				EditorView.updateListener.of((update) => {
					if (update.docChanged && onchange && !readonly) {
						onchange(update.state.doc.toString());
					}
				}),
				EditorView.theme({
					'&': {
						fontSize: '13px',
						fontFamily:
							'JetBrains Mono, Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace'
					},
					'.cm-content': {
						padding: '0px',
						minHeight: '50px',
						maxHeight: '300px'
					},
					'.cm-focused': {
						outline: 'none'
					},
					'.cm-editor': {
						borderRadius: '6px'
					},
					'.cm-line': {
						padding: '0 2px 0 4px'
					}
				}),
				EditorState.readOnly.of(readonly),
				assemblyExtension
			];

			const startState = EditorState.create({
				doc: value,
				extensions
			});

			editorView = new EditorView({
				state: startState,
				parent: editorContainer
			});
		}
	}

	onMount(() => {
		createOrUpdateEditor();
	});

	onDestroy(() => {
		editorView?.destroy();
		editorView = null;
	});

	// Update editor when value prop changes
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

<div bind:this={editorContainer} class="assembly-editor overflow-hidden">
	{#if !editorContainer}
		<div class="p-4 font-mono text-sm text-zinc-400">
			{placeholder}
		</div>
	{/if}
</div>

<style>
	.assembly-editor {
		--cm-font-family:
			'JetBrains Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
	}

	/* Background color overrides to match CodeEditor.svelte */
	:global(.assembly-editor .cm-editor) {
		height: 100%;
		background: transparent !important;
	}

	:global(.assembly-editor .cm-content) {
		background: transparent !important;
		color: rgb(244 244 245) !important;
	}

	:global(.assembly-editor .cm-gutters) {
		background: transparent !important;
		border-right: 1px solid transparent !important;
		color: rgb(115 115 115) !important;
	}

	:global(.assembly-editor .cm-activeLine) {
		background: rgba(255, 255, 255, 0.05) !important;
	}

	:global(.assembly-editor .cm-activeLineGutter) {
		background: rgba(255, 255, 255, 0.05) !important;
	}

	:global(.assembly-editor .cm-cursor) {
		border-left-color: rgb(244 244 245) !important;
	}
</style>
