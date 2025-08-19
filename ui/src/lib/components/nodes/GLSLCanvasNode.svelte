<script lang="ts">
	import { Handle, Position, useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { match, P } from 'ts-pattern';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import type { UserUniformValue } from '$lib/canvas/GLSystem';
	import type { GLUniformDef } from '../../../types/uniform-config';
	import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';
	import { getPatcher } from '../../../stores/patcher.store';

	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: { code: string; glUniformDefs: GLUniformDef[] };
		selected: boolean;
	} = $props();

	// Get flow utilities to update node data
	const { updateNodeData } = useSvelteFlow();
	const updateNodeInternals = useUpdateNodeInternals();

	// Get Patcher instance for headless canvas management
	const patcher = getPatcher();

	const width = $state(200);
	const height = $state(150);

	let previewCanvas = $state<HTMLCanvasElement | undefined>();
	let previewBitmapContext: ImageBitmapRenderingContext;

	let isPaused = $state(false);

	const code = $derived(data.code || '');

	const handleMessage: MessageCallbackFn = (message, meta) => {
		try {
			if (meta.inletKey?.startsWith('msg-in-')) {
				const [, uniformName] = meta.inletKey.split('-').slice(2);
				patcher.setNodeUniform(nodeId, uniformName, message);

				return;
			}

			match(message)
				.with({ type: 'set', code: P.string }, ({ code }) => {
					const newData = { ...data, code };
					updateNodeData(nodeId, newData);
					// Use Patcher's shader update method
					patcher.updateNodeShader(nodeId, code);
				})
				.with({ type: 'run' }, () => {
					updateShader();
				});
		} catch (error) {
			console.error('GLSLCanvasNode handleMessage error:', error);
		}
	};

	function updateShader() {
		// Use Patcher's centralized shader update method
		patcher.updateNodeShader(nodeId, data.code);

		// inform XYFlow that the handle has changed
		updateNodeInternals();
	}

	function togglePause() {
		isPaused = !isPaused;
		patcher.toggleNodePause(nodeId);
	}

	onMount(() => {
		patcher.addMessageListener(nodeId, handleMessage);

		if (previewCanvas) {
			previewBitmapContext = previewCanvas.getContext('bitmaprenderer')!;
			patcher.setVideoPreviewOutput(nodeId, previewCanvas);
		}

		updateShader();

		patcher.mountNode(nodeId);
	});

	onDestroy(() => {
		patcher.unmountNode(nodeId);
		patcher.removeMessageListener(nodeId, handleMessage);
	});
</script>

<CanvasPreviewLayout
	title="glsl.canvas"
	onrun={updateShader}
	onPlaybackToggle={togglePause}
	paused={isPaused}
	showPauseButton={true}
	bind:previewCanvas
	{width}
	{height}
	{selected}
>
	{#snippet topHandle()}
		{#each data.glUniformDefs as def, defIndex}
			<Handle
				type="target"
				position={Position.Top}
				id={`${def.type === 'sampler2D' ? 'video' : 'msg'}-in-${defIndex}-${def.name}-${def.type}`}
				style={`left: ${80 + defIndex * 20}px;`}
				title={`${def.name} (${def.type})`}
				class={def.type === 'sampler2D' ? '!bg-orange-500 hover:!bg-orange-400' : ''}
			/>
		{/each}
	{/snippet}

	{#snippet bottomHandle()}
		<Handle
			type="source"
			position={Position.Bottom}
			id={`video-out`}
			title="Video output"
			class="!bg-orange-500 hover:!bg-orange-400"
		/>
	{/snippet}

	{#snippet codeEditor()}
		<CodeEditor
			value={code}
			onchange={(newCode) => {
				const newData = { ...data, code: newCode };
				updateNodeData(nodeId, newData);
				// Use Patcher's shader update method
				patcher.updateNodeShader(nodeId, newCode);
			}}
			language="glsl"
			placeholder="Write your GLSL fragment shader here..."
			class="nodrag h-64 w-full resize-none"
			onrun={updateShader}
		/>
	{/snippet}
</CanvasPreviewLayout>
