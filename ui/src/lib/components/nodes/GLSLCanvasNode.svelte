<script lang="ts">
	import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { onMount, onDestroy } from 'svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import { match, P } from 'ts-pattern';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { GLSystem, type UserUniformValue } from '$lib/canvas/GLSystem';
	import { shaderCodeToUniformDefs } from '$lib/canvas/shader-code-to-uniform-def';
	import type { GLUniformDef } from '../../../types/uniform-config';
	import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';

	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: { title?: string; code: string; glUniformDefs: GLUniformDef[] };
		selected: boolean;
	} = $props();

	// Get flow utilities to update node data
	const { updateNodeData, getEdges, deleteElements } = useSvelteFlow();
	const updateNodeInternals = useUpdateNodeInternals();

	const width = $state(200);
	const height = $state(150);

	let glSystem: GLSystem;
	let previewCanvas = $state<HTMLCanvasElement | undefined>();
	let previewBitmapContext: ImageBitmapRenderingContext;
	let messageContext: MessageContext;

	let isPaused = $state(false);

	const code = $derived(data.code || '');

	const handleMessage: MessageCallbackFn = (message, meta) => {
		try {
			if (meta.inletKey?.startsWith('message-in-')) {
				const [, uniformName] = meta.inletKey.split('-').slice(2);
				glSystem.setUniformData(nodeId, uniformName, message as UserUniformValue);

				return;
			}

			match(message)
				.with({ type: 'set', code: P.string }, ({ code }) => {
					updateNodeData(nodeId, { code });
				})
				.with({ type: 'run' }, () => {
					updateShader();
				});
		} catch (error) {
			console.error('GLSLCanvasNode handleMessage error:', error);
		}
	};

	function removeInvalidEdges(uniformDefs: GLUniformDef[]) {
		const connectedEdges = getEdges().filter((edge) => edge.target === nodeId);

		const textureUniforms = new Set(
			uniformDefs.filter((def) => def.type === 'sampler2D').map((def) => def.name)
		);

		// Find edges that are no longer valid (uniform changed or removed)
		const invalidEdges = connectedEdges.filter((edge) => {
			if (!edge.targetHandle?.startsWith('video-in-')) return false;

			// Parse the uniform name: video-in-0-uniformName-sampler2D
			const handleParts = edge.targetHandle.split('-');

			if (handleParts.length > 3) {
				return !textureUniforms.has(handleParts[3]);
			}

			return false;
		});

		if (invalidEdges.length > 0) {
			console.log('removing invalid edges:', invalidEdges);
			deleteElements({ edges: invalidEdges });
		}
	}

	function updateShader() {
		// Construct uniform definitions from the shader code.
		const nextData = {
			...data,
			glUniformDefs: shaderCodeToUniformDefs(data.code)
		};

		// Remove edges with invalid uniform names before updating
		removeInvalidEdges(nextData.glUniformDefs);

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
	title={data.title ?? 'glsl'}
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
			<StandardHandle
				port="inlet"
				type={def.type === 'sampler2D' ? 'video' : 'message'}
				id={`${defIndex}-${def.name}-${def.type}`}
				title={`${def.name} (${def.type})`}
				total={data.glUniformDefs.length}
				index={defIndex}
			/>
		{/each}
	{/snippet}

	{#snippet bottomHandle()}
		<StandardHandle port="outlet" type="video" id="out" title="Video output" total={1} index={0} />
	{/snippet}

	{#snippet codeEditor()}
		<CodeEditor
			value={code}
			onchange={(newCode) => {
				updateNodeData(nodeId, { code: newCode });
			}}
			language="glsl"
			placeholder="Write your GLSL fragment shader here..."
			class="nodrag h-64 w-full resize-none"
			onrun={updateShader}
		/>
	{/snippet}
</CanvasPreviewLayout>
