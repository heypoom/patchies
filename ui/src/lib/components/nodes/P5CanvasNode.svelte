<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { P5Manager } from '$lib/p5/P5Manager';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import ObjectPreviewLayout from '$lib/components/ObjectPreviewLayout.svelte';

	let {
		id: nodeId,
		data,
		selected
	}: { id: string; data: { code: string }; selected: boolean } = $props();

	const { updateNodeData } = useSvelteFlow();

	let containerElement: HTMLDivElement;
	let measureElement: HTMLDivElement;
	let p5Manager: P5Manager | null = null;
	let glSystem = GLSystem.getInstance();
	let messageContext: MessageContext;
	let enableDrag = $state(true);
	let errorMessage = $state<string | null>(null);

	let previewContainerWidth = $state(0);
	const code = $derived(data.code || '');

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		p5Manager = new P5Manager(nodeId, containerElement);
		glSystem.upsertNode(nodeId, 'img', {});
		updateSketch();
		measureWidth();
	});

	onDestroy(() => {
		p5Manager?.destroy();
		glSystem.removeNode(nodeId);
		messageContext?.destroy();
	});

	function updateSketch() {
		// re-enable drag on update. nodrag() must be called on setup().
		enableDrag = true;

		if (p5Manager && messageContext) {
			try {
				p5Manager.updateCode({
					code,
					messageContext: {
						...messageContext.getContext(),
						noDrag: () => {
							enableDrag = false;
						}
					}
				});

				measureWidth();

				errorMessage = null;
			} catch (error) {
				// Capture compilation/setup errors
				errorMessage = error instanceof Error ? error.message : String(error);
			}
		}
	}

	function measureWidth() {
		setTimeout(() => {
			previewContainerWidth = Math.max(measureElement.clientWidth, containerElement.clientWidth);
		}, 50);
	}
</script>

<ObjectPreviewLayout title="p5.canvas" onrun={updateSketch} previewWidth={previewContainerWidth}>
	{#snippet topHandle()}
		<Handle type="target" position={Position.Top} class="z-1" />
	{/snippet}

	{#snippet preview()}
		<div class="relative" bind:this={measureElement}>
			<div
				bind:this={containerElement}
				class={[
					'rounded-md border bg-transparent',
					enableDrag ? 'cursor-grab' : 'nodrag cursor-default',
					selected
						? 'border-zinc-200 [&>canvas]:rounded-[7px]'
						: 'border-transparent [&>canvas]:rounded-md'
				]}
			></div>
		</div>
	{/snippet}

	{#snippet bottomHandle()}
		<Handle type="source" position={Position.Bottom} class="absolute" />

		<VideoHandle
			type="source"
			position={Position.Bottom}
			id="video-out"
			class="z-1 !left-20"
			title="Video output"
		/>
	{/snippet}

	{#snippet codeEditor()}
		<CodeEditor
			value={code}
			onchange={(newCode) => {
				updateNodeData(nodeId, { ...data, code: newCode });
			}}
			language="javascript"
			placeholder="Write your p5.js code here..."
			class="nodrag h-64 w-full resize-none"
			onrun={updateSketch}
		/>
	{/snippet}
</ObjectPreviewLayout>
