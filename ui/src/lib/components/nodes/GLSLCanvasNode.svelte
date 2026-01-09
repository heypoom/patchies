<script lang="ts">
	import { useSvelteFlow, useUpdateNodeInternals, useViewport } from '@xyflow/svelte';
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
		data: {
			title?: string;
			code: string;
			glUniformDefs: GLUniformDef[];
			executeCode?: number;
		};
		selected: boolean;
	} = $props();

	const { updateNodeData, getEdges, deleteElements, screenToFlowPosition } = useSvelteFlow();
	const updateNodeInternals = useUpdateNodeInternals();
	const viewport = useViewport();

	let glSystem = GLSystem.getInstance();

	// Preview canvas display size
	let width = $state(glSystem.previewSize[0]);
	let height = $state(glSystem.previewSize[1]);

	// Actual rendering resolution (for mouse coordinates)
	let outputWidth = $state(glSystem.outputSize[0]);
	let outputHeight = $state(glSystem.outputSize[1]);

	let previewCanvas = $state<HTMLCanvasElement | undefined>();
	let previewBitmapContext: ImageBitmapRenderingContext;
	let messageContext: MessageContext;

	let isPaused = $state(false);
	let editorReady = $state(false);

	const code = $derived(data.code || '');
	let previousExecuteCode = $state<number | undefined>(undefined);

	// Detect if shader uses iMouse uniform (ignore comments)
	const usesMouseUniform = $derived.by(() => {
		// Remove single-line comments
		const codeWithoutComments = code.replace(/\/\/.*$/gm, '');

		return codeWithoutComments.includes('iMouse');
	});

	// Mouse state for Shadertoy iMouse uniform
	let mouseState = $state({ x: 0, y: 0, z: 0, w: 0 });
	let isMouseDown = $state(false);

	// Watch for executeCode timestamp changes and re-run when it changes
	$effect(() => {
		if (data.executeCode && data.executeCode !== previousExecuteCode) {
			previousExecuteCode = data.executeCode;
			updateShader();
		}
	});

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

	function handleCanvasMouseMove(event: MouseEvent) {
		if (!previewCanvas || !usesMouseUniform) return;

		const rect = previewCanvas.getBoundingClientRect();

		// Get position relative to canvas in screen pixels
		const screenX = event.clientX - rect.left;
		const screenY = event.clientY - rect.top;

		// Map from displayed rect to actual framebuffer resolution (outputSize)
		// fragCoord matches the actual FBO size, NOT iResolution (which includes pixelRatio)
		const x = (screenX / rect.width) * outputWidth;
		const y = (screenY / rect.height) * outputHeight;

		mouseState.x = x;
		mouseState.y = y;

		// If mouse is down, update click position with negative values
		if (isMouseDown) {
			mouseState.z = -mouseState.z;
			mouseState.w = -mouseState.w;
		}

		glSystem.setMouseData(nodeId, mouseState.x, mouseState.y, mouseState.z, mouseState.w);
	}

	function handleCanvasMouseDown(event: MouseEvent) {
		if (!previewCanvas || !usesMouseUniform) return;

		const rect = previewCanvas.getBoundingClientRect();

		// Get position relative to canvas in screen pixels
		const screenX = event.clientX - rect.left;
		const screenY = event.clientY - rect.top;

		// Map from displayed rect to actual framebuffer resolution (outputSize)
		// fragCoord matches the actual FBO size, NOT iResolution (which includes pixelRatio)
		const x = (screenX / rect.width) * outputWidth;
		const y = (screenY / rect.height) * outputHeight;

		isMouseDown = true;
		mouseState.z = x;
		mouseState.w = y;
		mouseState.x = x;
		mouseState.y = y;

		glSystem.setMouseData(nodeId, mouseState.x, mouseState.y, mouseState.z, mouseState.w);
	}

	function handleCanvasMouseUp() {
		if (!usesMouseUniform) return;

		isMouseDown = false;

		// Reset to positive values when mouse is up
		if (mouseState.z < 0) mouseState.z = -mouseState.z;
		if (mouseState.w < 0) mouseState.w = -mouseState.w;

		glSystem.setMouseData(nodeId, mouseState.x, mouseState.y, mouseState.z, mouseState.w);
	}

	// Attach mouse event listeners when canvas is available and iMouse is used
	$effect(() => {
		if (!previewCanvas || !usesMouseUniform) return;

		previewCanvas.addEventListener('mousemove', handleCanvasMouseMove);
		previewCanvas.addEventListener('mousedown', handleCanvasMouseDown);
		previewCanvas.addEventListener('mouseup', handleCanvasMouseUp);
		previewCanvas.addEventListener('mouseleave', handleCanvasMouseUp);

		return () => {
			if (!previewCanvas) return;
			previewCanvas.removeEventListener('mousemove', handleCanvasMouseMove);
			previewCanvas.removeEventListener('mousedown', handleCanvasMouseDown);
			previewCanvas.removeEventListener('mouseup', handleCanvasMouseUp);
			previewCanvas.removeEventListener('mouseleave', handleCanvasMouseUp);
		};
	});

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
	nodrag={usesMouseUniform}
	bind:previewCanvas
	{width}
	{height}
	{selected}
	{editorReady}
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
			onready={() => (editorReady = true)}
		/>
	{/snippet}
</CanvasPreviewLayout>
