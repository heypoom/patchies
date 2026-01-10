<script lang="ts">
	import { useSvelteFlow, useUpdateNodeInternals, useViewport } from '@xyflow/svelte';
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
			hidePorts?: boolean;
			executeCode?: number;
			paused?: boolean;
		};
		selected: boolean;
	} = $props();

	const { updateNodeData } = useSvelteFlow();
	const updateNodeInternals = useUpdateNodeInternals();
	const viewport = useViewport();

	let containerElement: HTMLDivElement;
	let measureElement: HTMLDivElement;
	let p5Manager: P5Manager | null = null;
	let glSystem = GLSystem.getInstance();
	let messageContext: MessageContext;
	let enableDrag = $state(true);
	let videoOutputEnabled = $state(true);
	let errorMessage = $state<string | null>(null);
	let editorReady = $state(false);

	let previewContainerWidth = $state(0);
	const code = $derived(data.code || '');
	let inletCount = $derived(data.inletCount ?? 1);
	let outletCount = $derived(data.outletCount ?? 1);
	let previousExecuteCode = $state<number | undefined>(undefined);

	// Local state for pre-parsed canvas dimensions (not persisted)
	let preloadCanvasWidth = $state<number | undefined>(0);
	let preloadCanvasHeight = $state<number | undefined>(0);

	// Watch for executeCode timestamp changes and re-run when it changes
	$effect(() => {
		if (data.executeCode && data.executeCode !== previousExecuteCode) {
			previousExecuteCode = data.executeCode;
			updateSketch();
		}
	});

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		p5Manager = new P5Manager(nodeId, containerElement, viewport);
		glSystem.upsertNode(nodeId, 'img', {});

		// Pre-parse createCanvas() dimensions before P5.js loads
		// This prevents layout shift by setting correct size immediately
		if (code) {
			const canvasMatch = code.match(/createCanvas\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/);

			if (canvasMatch) {
				preloadCanvasWidth = parseInt(canvasMatch[1], 10);
				preloadCanvasHeight = parseInt(canvasMatch[2], 10);
			}
		}

		updateSketch({onMount: true});
		measureWidth(1000);
	});

	onDestroy(() => {
		p5Manager?.destroy();
		glSystem.removeNode(nodeId);
		messageContext?.destroy();
	});

	const setPortCount = (inletCount = 1, outletCount = 1) => {
		updateNodeData(nodeId, { inletCount, outletCount });
		updateNodeInternals(nodeId);
	};

	function togglePlayback() {
		const p5 = p5Manager?.p5;
		if (!p5) return;

		if (data.paused) {
			// Unpause the sketch by restarting the animation loop
			p5.loop();
			updateNodeData(nodeId, { paused: false });
		} else {
			// Pause the sketch by stopping the animation loop
			p5.noLoop();
			updateNodeData(nodeId, { paused: true });
		}
	}

	function updateSketch({onMount = false}: {onMount?: boolean} = {}) {
		// re-enable drag on update. nodrag() must be called on setup().
		enableDrag = true;
		videoOutputEnabled = true;

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
						noOutput: () => {
							videoOutputEnabled = false;
							updateNodeInternals(nodeId);
						},
						setPortCount,
						setTitle: (title: string) => {
							updateNodeData(nodeId, { title });
						}
					},
					setHidePorts: (hide: boolean) => {
						updateNodeData(nodeId, { hidePorts: hide });
					},
					pauseOnMount: onMount && !!data.paused
				});

				measureWidth(100);

				// Clear pre-parsed canvas dimensions after P5.js has loaded
				// This allows createCanvas() to dynamically resize on subsequent code changes
				setTimeout(() => {
					preloadCanvasWidth = undefined;
					preloadCanvasHeight = undefined;
				}, 150);

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



	const handleClass = $derived.by(() => {
		if (!data.hidePorts) return '';

		return `z-1 transition-opacity ${selected ? '' : 'sm:opacity-0 opacity-30 group-hover:opacity-100'}`;
	});
</script>

<ObjectPreviewLayout
	title={data.title ?? 'p5'}
	onrun={updateSketch}
	previewWidth={previewContainerWidth}
	showPauseButton
	paused={data.paused}
	onPlaybackToggle={togglePlayback}
	{editorReady}
>
	{#snippet topHandle()}
		{#each Array.from({ length: inletCount }) as _, index (index)}
			<StandardHandle
				port="inlet"
				id={index}
				title={`Inlet ${index}`}
				total={inletCount}
				{index}
				class={handleClass}
				nodeId={nodeId}
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
						? 'shadow-glow-md border-zinc-200 [&>canvas]:rounded-[7px]'
						: 'hover:shadow-glow-sm border-transparent [&>canvas]:rounded-md'
				]}
				style={preloadCanvasWidth && preloadCanvasHeight
					? `min-width: ${preloadCanvasWidth}px; min-height: ${preloadCanvasHeight}px;`
					: ''}
			></div>
		</div>
	{/snippet}

	{#snippet bottomHandle()}
		{#if videoOutputEnabled}
			<StandardHandle
				port="outlet"
				type="video"
				id="0"
				title="Video output"
				total={outletCount + 1}
				index={0}
				class={handleClass}
				nodeId={nodeId}
			/>
		{/if}

		{#each Array.from({ length: outletCount }) as _, index (index)}
			<StandardHandle
				port="outlet"
				id={index}
				title={`Outlet ${index}`}
				total={videoOutputEnabled ? outletCount + 1 : outletCount}
				index={videoOutputEnabled ? index + 1 : index}
				class={handleClass}
				nodeId={nodeId}
			/>
		{/each}
	{/snippet}

	{#snippet codeEditor()}
		<CodeEditor
			value={code}
			onchange={(newCode) => {
				updateNodeData(nodeId, { code: newCode });
			}}
			language="javascript"
			nodeType="p5"
			placeholder="Write your p5.js code here..."
			class="nodrag h-64 w-full resize-none"
			onrun={updateSketch}
			onready={() => (editorReady = true)}
		/>
	{/snippet}
</ObjectPreviewLayout>
