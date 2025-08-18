<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { marked } from 'marked';
	import ObjectPreviewLayout from '../ObjectPreviewLayout.svelte';
	import CodeEditor from '../CodeEditor.svelte';
	import { onMount } from 'svelte';

	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: { markdown: string };
		selected: boolean;
	} = $props();

	let previewContainer: HTMLDivElement | undefined = $state();
	let previewWidth = $state(10);

	let renderedHtml = $derived.by(() => {
		try {
			return marked(data.markdown);
		} catch (error) {
			return '<p style="color: red;">Error parsing markdown</p>';
		}
	});

	const { updateNodeData } = useSvelteFlow();

	function handleMarkdownChange(markdown: string) {
		updateNodeData(nodeId, { ...data, markdown });
		measureWidth();
	}

	onMount(() => {
		measureWidth();
	});

	function measureWidth() {
		setTimeout(() => {
			if (previewContainer) {
				previewWidth = previewContainer.clientWidth;
			}
		}, 100);
	}

	const borderColor = $derived(selected ? 'border-zinc-400' : 'border-zinc-700');
</script>

<ObjectPreviewLayout title="markdown" previewWidth={previewWidth + 5}>
	{#snippet topHandle()}
		<Handle type="target" position={Position.Top} class="z-1" />
	{/snippet}

	{#snippet preview()}
		<div
			class={['overflow-auto rounded-lg border px-4 py-3 text-white shadow-lg', borderColor]}
			bind:this={previewContainer}
		>
			{@html renderedHtml}
		</div>
	{/snippet}

	{#snippet codeEditor()}
		<CodeEditor
			value={data.markdown}
			onchange={handleMarkdownChange}
			language="markdown"
			placeholder="# Write markdown here..."
			class="h-80 w-96"
		/>
	{/snippet}

	{#snippet bottomHandle()}
		<Handle type="source" position={Position.Bottom} class="z-1" />
	{/snippet}
</ObjectPreviewLayout>
