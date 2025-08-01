<script lang="ts">
	import { Handle, Position, useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import { match } from 'ts-pattern';
	import type { Message } from '$lib/messages/MessageSystem';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import { shaderCodeToUniformDefs } from '$lib/canvas/shader-code-to-uniform-def';
	import type { GLUniformDef } from '../../../types/uniform-config';

	// Get node data from XY Flow - nodes receive their data as props
	let {
		id: nodeId,
		data,
		type
	}: { id: string; data: { code: string; glUniformDefs: GLUniformDef[] }; type: string } = $props();

	// Get flow utilities to update node data
	const { updateNodeData } = useSvelteFlow();
	const updateNodeInternals = useUpdateNodeInternals();

	const width = $state(200);
	const height = $state(150);

	let glSystem: GLSystem;
	let previewCanvas: HTMLCanvasElement;
	let previewBitmapContext: ImageBitmapRenderingContext;
	let messageContext: MessageContext;

	let showEditor = $state(false);

	const code = $derived(data.code || '');

	function handleMessage(message: Message) {
		if (message.inlet?.startsWith('gl-in-')) {
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
		glSystem.upsertNode(nodeId, type, nextData);

		// inform XYFlow that the handle has changed
		updateNodeInternals();
	}

	onMount(() => {
		previewBitmapContext = previewCanvas.getContext('bitmaprenderer')!;
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);

		glSystem = GLSystem.getInstance();
		glSystem.previewCanvasContexts[nodeId] = previewBitmapContext;
		updateShader();

		setTimeout(() => {
			glSystem.setPreviewEnabled(nodeId, true);
		}, 10);
	});

	onDestroy(() => {
		messageContext.queue.removeCallback(handleMessage);
		messageContext?.destroy();
		glSystem.removeNode(nodeId);

		// Unregister the context if we are still using it.
		if (glSystem.previewCanvasContexts[nodeId] === previewBitmapContext) {
			glSystem.previewCanvasContexts[nodeId] = null;
		}
	});
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
					<div class="font-mono text-xs font-medium text-zinc-100">glsl.canvas</div>
				</div>

				<button
					title="Edit code"
					class="rounded p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
					onclick={() => {
						showEditor = !showEditor;
					}}
				>
					<Icon icon="lucide:code" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="relative">
				{#each data.glUniformDefs as def, defIndex}
					<Handle
						type="target"
						position={Position.Top}
						id={`gl-in-${defIndex}-${def.name}-${def.type}`}
						style={`left: ${80 + defIndex * 20}px;`}
						title={`${def.name} (${def.type})`}
						class="!border-violet-400 !bg-violet-500 hover:!bg-violet-400"
					/>
				{/each}

				<div class="rounded-md bg-zinc-900">
					<canvas
						bind:this={previewCanvas}
						{width}
						{height}
						class="rounded-md"
						data-preview-canvas="true"
					></canvas>
				</div>

				<Handle
					type="source"
					position={Position.Bottom}
					id={`gl-out`}
					title="Video output"
					class="!border-violet-400 !bg-violet-500 hover:!bg-violet-400"
				/>
			</div>
		</div>
	</div>

	{#if showEditor}
		<div class="relative">
			<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
				<button onclick={updateShader} class="rounded p-1 hover:bg-zinc-700">
					<Icon icon="lucide:play" class="h-4 w-4 text-zinc-300" />
				</button>

				<button onclick={() => (showEditor = false)} class="rounded p-1 hover:bg-zinc-700">
					<Icon icon="lucide:x" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
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
			</div>
		</div>
	{/if}
</div>
