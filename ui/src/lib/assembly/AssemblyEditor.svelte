<script lang="ts">
	import { EditorView } from '@codemirror/view';
	import { EditorState } from '@codemirror/state';
	import { basicSetup } from 'codemirror';
	import { oneDark } from '@codemirror/theme-one-dark';
	import { javascript } from '@codemirror/lang-javascript';
	import { onMount } from 'svelte';

	interface Props {
		value: string;
		onchange?: (value: string) => void;
		placeholder?: string;
		readonly?: boolean;
	}

	let { value = '', onchange, placeholder = 'Enter assembly code...', readonly = false }: Props = $props();

	let editorContainer = $state<HTMLDivElement>();
	let editorView: EditorView | null = null;

	onMount(() => {
		const extensions = [
			basicSetup,
			oneDark,
			// For now use JavaScript highlighting until we create assembly syntax
			javascript(),
			EditorView.updateListener.of((update) => {
				if (update.docChanged && onchange && !readonly) {
					onchange(update.state.doc.toString());
				}
			}),
			EditorView.theme({
				'&': {
					fontSize: '13px',
					fontFamily: 'JetBrains Mono, Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace'
				},
				'.cm-content': {
					padding: '8px',
					minHeight: '100px',
					maxHeight: '300px'
				},
				'.cm-focused': {
					outline: 'none'
				},
				'.cm-editor': {
					borderRadius: '6px'
				}
			}),
			EditorState.readOnly.of(readonly)
		];

		const startState = EditorState.create({
			doc: value,
			extensions
		});

		editorView = new EditorView({
			state: startState,
			parent: editorContainer
		});

		return () => {
			editorView?.destroy();
		};
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

<div bind:this={editorContainer} class="assembly-editor border border-zinc-700 rounded-md overflow-hidden">
	{#if !editorContainer}
		<div class="p-4 text-zinc-400 font-mono text-sm">
			{placeholder}
		</div>
	{/if}
</div>

<style>
	.assembly-editor {
		--cm-font-family: 'JetBrains Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
	}
</style>