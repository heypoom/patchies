<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';
	import { getPortPosition } from '$lib/utils/node-utils';

	let {
		id: nodeId,
		data,
		selected
	}: { id: string; type: string; data: { code: string }; selected: boolean } = $props();

	const { updateNodeData } = useSvelteFlow();

	let glSystem: GLSystem;
	let messageContext: MessageContext;
	let previewCanvas = $state<HTMLCanvasElement | undefined>();
	let previewBitmapContext: ImageBitmapRenderingContext;
	let isPaused = $state(false);
	let errorMessage = $state<string | null>(null);

	const code = $derived(data.code || '');

	const setCodeAndUpdate = (newCode: string) => {
		updateNodeData(nodeId, { ...data, code: newCode });
		setTimeout(() => updateSwissGL());
	};

	const handleMessage: MessageCallbackFn = (message, meta) => {
		try {
			match(message)
				.with({ type: 'set', code: P.string }, ({ code }) => {
					setCodeAndUpdate(code);
				})
				.with({ type: 'run' }, updateSwissGL)
				.otherwise(() => {
					glSystem.sendMessageToNode(nodeId, { ...meta, data: message });
				});
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		}
	};

	onMount(() => {
		glSystem = GLSystem.getInstance();
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);

		if (previewCanvas) {
			previewBitmapContext = previewCanvas.getContext('bitmaprenderer')!;

			const [previewWidth, previewHeight] = glSystem.previewSize;
			previewCanvas.width = previewWidth;
			previewCanvas.height = previewHeight;
		}

		glSystem.previewCanvasContexts[nodeId] = previewBitmapContext;
		glSystem.upsertNode(nodeId, 'swgl', { code });

		setTimeout(() => {
			glSystem.setPreviewEnabled(nodeId, true);
		}, 10);
	});

	onDestroy(() => {
		messageContext.destroy();
		glSystem.removeNode(nodeId);
		glSystem.removePreviewContext(nodeId, previewBitmapContext);
	});

	function updateSwissGL() {
		try {
			messageContext.clearTimers();
			glSystem.upsertNode(nodeId, 'swgl', { code });

			errorMessage = null;
		} catch (error) {
			// Capture compilation/setup errors
			errorMessage = error instanceof Error ? error.message : String(error);
		}
	}

	function togglePause() {
		isPaused = !isPaused;
		glSystem.toggleNodePause(nodeId);
	}
</script>

<CanvasPreviewLayout
	title="swgl"
	onrun={updateSwissGL}
	onPlaybackToggle={togglePause}
	paused={isPaused}
	showPauseButton={true}
	{selected}
	{errorMessage}
	bind:previewCanvas
>
	{#snippet topHandle()}
		<Handle
			type="target"
			position={Position.Top}
			class="z-1"
			id="message-in"
			title="Message input"
		/>
	{/snippet}

	{#snippet bottomHandle()}
		<VideoHandle
			type="source"
			position={Position.Bottom}
			id="video-out-0"
			class="z-1"
			title="Video output"
			style={`left: ${getPortPosition(2, 0)}`}
		/>

		<Handle
			type="source"
			position={Position.Bottom}
			id="message-out"
			title="Message output"
			class="z-1"
			style={`left: ${getPortPosition(2, 1)}`}
		/>
	{/snippet}

	{#snippet codeEditor()}
		<CodeEditor
			value={code}
			onchange={(newCode) => {
				updateNodeData(nodeId, { ...data, code: newCode });
			}}
			language="javascript"
			placeholder="Write your SwissGL code here..."
			class="nodrag h-64 w-full resize-none"
			onrun={updateSwissGL}
		/>
	{/snippet}
</CanvasPreviewLayout>
