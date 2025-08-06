<script lang="ts">
	import { Handle, Position, useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import { match } from 'ts-pattern';
	import type { Message } from '$lib/messages/MessageSystem';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import { shaderCodeToUniformDefs } from '$lib/canvas/shader-code-to-uniform-def';
	import type { GLUniformDef } from '../../../types/uniform-config';
	import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';

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

	const width = $state(200);
	const height = $state(150);

	let glSystem: GLSystem;
	let previewCanvas = $state<HTMLCanvasElement | undefined>();
	let previewBitmapContext: ImageBitmapRenderingContext;
	let messageContext: MessageContext;

	let isPaused = $state(false);

	const code = $derived(data.code || '');

	function handleMessage(message: Message) {
		if (message.inlet?.startsWith('msg-in-')) {
			const [indexStr, uniformName, uniformType] = message.inlet.split('-').slice(2);

			glSystem.setUniformData(nodeId, uniformName, message.data);
			return;
		}

		match(message.data)
			.with('set', () => {
				updateNodeData(nodeId, { ...data, code: message.data.code });
			})
			.with('run', updateShader);
	}

	function updateShader() {
		// Construct uniform definitions from the shader code.
		const nextData = {
			...data,
			glUniformDefs: shaderCodeToUniformDefs(data.code)
		};

		updateNodeData(nodeId, nextData);
		glSystem.upsertNode(nodeId, 'glsl', nextData);

		// inform XYFlow that the handle has changed
		updateNodeInternals();
	}

	function togglePause() {
		isPaused = !isPaused;
		glSystem.toggleNodePause(nodeId);
	}

	onMount(() => {
		glSystem = GLSystem.getInstance();

		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);

		if (previewCanvas) {
			previewBitmapContext = previewCanvas.getContext('bitmaprenderer')!;
			glSystem.previewCanvasContexts[nodeId] = previewBitmapContext;
		}

		updateShader();

		setTimeout(() => {
			glSystem.setPreviewEnabled(nodeId, true);
		}, 10);
	});

	onDestroy(() => {
		messageContext.queue.removeCallback(handleMessage);
		messageContext.destroy();
		glSystem.removeNode(nodeId);
		glSystem.removePreviewContext(nodeId, previewBitmapContext);
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
				class={def.type === 'sampler2D'
					? '!border-orange-400 !bg-orange-500 hover:!bg-orange-400'
					: ''}
			/>
		{/each}
	{/snippet}

	{#snippet bottomHandle()}
		<Handle
			type="source"
			position={Position.Bottom}
			id={`video-out`}
			title="Video output"
			class="!border-orange-400 !bg-orange-500 hover:!bg-orange-400"
		/>
	{/snippet}

	{#snippet codeEditor()}
		<CodeEditor
			value={code}
			onchange={(newCode) => {
				updateNodeData(nodeId, { ...data, code: newCode });
			}}
			language="glsl"
			placeholder="Write your GLSL fragment shader here..."
			class="nodrag h-64 w-full resize-none"
			onrun={updateShader}
		/>
	{/snippet}
</CanvasPreviewLayout>
