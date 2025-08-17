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
	import { AudioAnalysisSystem } from '$lib/audio/AudioAnalysisSystem';

	let {
		id: nodeId,
		data,
		selected
	}: { id: string; type: string; data: { code: string }; selected: boolean } = $props();

	const { updateNodeData } = useSvelteFlow();

	let glSystem: GLSystem;
	let audioAnalysisSystem: AudioAnalysisSystem;
	let messageContext: MessageContext;
	let previewCanvas = $state<HTMLCanvasElement | undefined>();
	let previewBitmapContext: ImageBitmapRenderingContext;
	let isPaused = $state(false);
	let errorMessage = $state<string | null>(null);

	const code = $derived(data.code || '');

	const setCodeAndUpdate = (newCode: string) => {
		updateNodeData(nodeId, { ...data, code: newCode });
		setTimeout(() => updateHydra());
	};

	const handleMessage: MessageCallbackFn = (message, meta) => {
		try {
			match(message)
				.with({ type: 'set', code: P.string }, ({ code }) => {
					setCodeAndUpdate(code);
				})
				.with({ type: 'run' }, () => {
					updateHydra();
				})
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
		audioAnalysisSystem = AudioAnalysisSystem.getInstance();

		if (previewCanvas) {
			previewBitmapContext = previewCanvas.getContext('bitmaprenderer')!;

			const [previewWidth, previewHeight] = glSystem.previewSize;
			previewCanvas.width = previewWidth;
			previewCanvas.height = previewHeight;
		}

		glSystem.previewCanvasContexts[nodeId] = previewBitmapContext;
		glSystem.upsertNode(nodeId, 'hydra', { code });

		setTimeout(() => {
			glSystem.setPreviewEnabled(nodeId, true);
		}, 10);
	});

	onDestroy(() => {
		messageContext.destroy();
		glSystem.removeNode(nodeId);
		glSystem.removePreviewContext(nodeId, previewBitmapContext);
	});

	function updateHydra() {
		try {
			messageContext.clearIntervals();
			audioAnalysisSystem.disableFFT(nodeId);

			const isUpdated = glSystem.upsertNode(nodeId, 'hydra', { code });

			// If the code hasn't changed, the code will not be re-run.
			// This allows us to forcibly re-run hydra to update FFT.
			if (!isUpdated) glSystem.send('updateHydra', { nodeId });

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
	title="hydra"
	onrun={updateHydra}
	onPlaybackToggle={togglePause}
	paused={isPaused}
	showPauseButton={true}
	{selected}
	{errorMessage}
	bind:previewCanvas
>
	{#snippet topHandle()}
		<VideoHandle
			type="target"
			position={Position.Top}
			id="video-in-0"
			class="!left-16 z-1"
			title="Video input 0"
		/>

		<VideoHandle
			type="target"
			position={Position.Top}
			id="video-in-1"
			class="!left-20 z-1"
			title="Video input 1"
		/>

		<VideoHandle
			type="target"
			position={Position.Top}
			id="video-in-2"
			class="!left-24 z-1"
			title="Video input 2"
		/>

		<VideoHandle
			type="target"
			position={Position.Top}
			id="video-in-3"
			class="!left-28 z-1"
			title="Video input 3"
		/>

		<Handle
			type="target"
			position={Position.Top}
			class="!left-32 z-1"
			id="message-in"
			title="Message input"
		/>
	{/snippet}

	{#snippet bottomHandle()}
		<VideoHandle
			type="source"
			position={Position.Bottom}
			id="video-out"
			class="!left-22 z-1"
			title="Video output"
		/>

		<Handle
			type="source"
			position={Position.Bottom}
			id="message-out"
			title="Message output"
			class="!left-28 z-1"
		/>
	{/snippet}

	{#snippet codeEditor()}
		<CodeEditor
			value={code}
			onchange={(newCode) => {
				updateNodeData(nodeId, { ...data, code: newCode });
			}}
			language="javascript"
			placeholder="Write your Hydra code here..."
			class="nodrag h-64 w-full resize-none"
			onrun={updateHydra}
		/>
	{/snippet}
</CanvasPreviewLayout>
