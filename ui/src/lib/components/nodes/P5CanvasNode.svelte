<script lang="ts">
	import { Handle, Position, useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { P5Manager } from '$lib/p5/P5Manager';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import ObjectPreviewLayout from '$lib/components/ObjectPreviewLayout.svelte';
	import { getPortPosition } from '$lib/utils/node-utils';

	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: {
			code: string;
			inletCount?: number;
			outletCount?: number;
		};
		selected: boolean;
	} = $props();

	const { updateNodeData } = useSvelteFlow();
	const updateNodeInternals = useUpdateNodeInternals();

	let containerElement: HTMLDivElement;
	let measureElement: HTMLDivElement;
	let p5Manager: P5Manager | null = null;
	let glSystem = GLSystem.getInstance();
	let messageContext: MessageContext;
	let enableDrag = $state(true);
	let errorMessage = $state<string | null>(null);

	let previewContainerWidth = $state(0);
	const code = $derived(data.code || '');
	let inletCount = $derived(data.inletCount ?? 1);
	let outletCount = $derived(data.outletCount ?? 1);

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		p5Manager = new P5Manager(nodeId, containerElement);
		glSystem.upsertNode(nodeId, 'img', {});
		updateSketch();
		measureWidth(1000);
	});

	onDestroy(() => {
		p5Manager?.destroy();
		glSystem.removeNode(nodeId);
		messageContext?.destroy();
	});

	const setPortCount = (inletCount = 1, outletCount = 1) => {
		updateNodeData(nodeId, { ...data, inletCount, outletCount });
		updateNodeInternals(nodeId);
	};

	function updateSketch() {
		// re-enable drag on update. nodrag() must be called on setup().
		enableDrag = true;

		setPortCount(1, 1);

		if (p5Manager && messageContext) {
			try {
				p5Manager.updateCode({
					code,
					messageContext: {
						...messageContext.getContext(),
						noDrag: () => {
							enableDrag = false;
						},
						setPortCount
					}
				});

				measureWidth(100);

				errorMessage = null;
			} catch (error) {
				// Capture compilation/setup errors
				errorMessage = error instanceof Error ? error.message : String(error);
			}
		}
	}

	function measureWidth(timeout: number) {
		setTimeout(() => {
			previewContainerWidth = Math.max(measureElement.clientWidth, containerElement.clientWidth);
		}, timeout);
	}
</script>

<ObjectPreviewLayout title="p5.canvas" onrun={updateSketch} previewWidth={previewContainerWidth}>
	{#snippet topHandle()}
		{#each Array.from({ length: inletCount }) as _, index}
			<Handle
				type="target"
				id={`in-${index}`}
				position={Position.Top}
				style={`left: ${getPortPosition(inletCount, index)}`}
				title={`Inlet ${index}`}
				class="z-1"
			/>
		{/each}
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
		<VideoHandle
			type="source"
			position={Position.Bottom}
			id="video-out-0"
			style={`left: ${getPortPosition(outletCount + 1, 0)}`}
			title="Video output"
			class="z-1"
		/>

		{#each Array.from({ length: outletCount }) as _, index}
			<Handle
				type="source"
				id={`out-${index}`}
				position={Position.Bottom}
				style={`left: ${getPortPosition(outletCount + 1, index + 1)}`}
				title={`Outlet ${index}`}
				class="z-1"
			/>
		{/each}
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
