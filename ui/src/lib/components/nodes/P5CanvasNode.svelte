<script lang="ts">
	import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { P5Manager } from '$lib/p5/P5Manager';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import ObjectPreviewLayout from '$lib/components/ObjectPreviewLayout.svelte';

	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: {
			title?: string;
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
	let paused = $state(false);

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
		paused = false;

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
						setPortCount,
						setTitle: (title: string) => {
							updateNodeData(nodeId, { ...data, title });
						}
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

	function togglePlayback() {
		const p5 = p5Manager?.p5;
		if (!p5) return;

		const isLooping = p5?.isLooping();

		if (paused) {
			p5?.loop();
		} else {
			p5?.noLoop();
		}

		paused = isLooping;
	}
</script>

<ObjectPreviewLayout
	title={data.title ?? 'p5'}
	onrun={updateSketch}
	previewWidth={previewContainerWidth}
	showPauseButton
	{paused}
	onPlaybackToggle={togglePlayback}
>
	{#snippet topHandle()}
		{#each Array.from({ length: inletCount }) as _, index}
			<StandardHandle port="inlet" id={index} title={`Inlet ${index}`} total={inletCount} {index} />
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
		<StandardHandle
			port="outlet"
			type="video"
			id="0"
			title="Video output"
			total={outletCount + 1}
			index={0}
			class=""
		/>

		{#each Array.from({ length: outletCount }) as _, index}
			<StandardHandle
				port="outlet"
				id={index + 1}
				title={`Outlet ${index}`}
				total={outletCount + 1}
				index={index + 1}
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
