<script lang="ts">
	import { Handle, Position, useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import type { Message } from '$lib/messages/MessageSystem';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import { hydraSourcesMap } from '../../../stores/renderer.store';

	let {
		id: nodeId,
		data,
		selected
	}: { id: string; type: string; data: { code: string }; selected: boolean } = $props();

	const { updateNodeData } = useSvelteFlow();
	const updateNodeInternals = useUpdateNodeInternals();

	let glSystem: GLSystem;
	let messageContext: MessageContext;
	let previewCanvas: HTMLCanvasElement;
	let previewBitmapContext: ImageBitmapRenderingContext;
	let showEditor = $state(false);
	let errorMessage = $state<string | null>(null);

	const code = $derived(data.code || '');

	const setCodeAndUpdate = (newCode: string) => {
		updateNodeData(nodeId, { ...data, code: newCode });
		setTimeout(() => updateHydra());
	};

	function handleMessageNodeCallback(message: Message) {
		if (message.data.type === 'set') {
			setCodeAndUpdate(message.data.code);
		} else if (message.data.type === 'run') {
			updateHydra();
		}
	}

	$effect(() => {
		if ($hydraSourcesMap[nodeId]?.length > 0) {
			updateNodeInternals();
		}
	});

	onMount(() => {
		glSystem = GLSystem.getInstance();
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessageNodeCallback);
		previewBitmapContext = previewCanvas.getContext('bitmaprenderer')!;

		previewCanvas.width = 200;
		previewCanvas.height = 150;

		glSystem.previewCanvasContexts[nodeId] = previewBitmapContext;
		glSystem.upsertNode(nodeId, 'hydra', { code });

		setTimeout(() => {
			glSystem.setPreviewEnabled(nodeId, true);
			updateNodeInternals();
		}, 10);
	});

	onDestroy(() => {
		messageContext.destroy();
		glSystem.removeNode(nodeId);

		// Unregister the context if we are still using it.
		if (glSystem.previewCanvasContexts[nodeId] === previewBitmapContext) {
			glSystem.previewCanvasContexts[nodeId] = null;
		}
	});

	function updateHydra() {
		try {
			messageContext.clearIntervals();
			glSystem.upsertNode(nodeId, 'hydra', { code });

			errorMessage = null;
		} catch (error) {
			// Capture compilation/setup errors
			errorMessage = error instanceof Error ? error.message : String(error);
		}
	}

	function toggleEditor() {
		showEditor = !showEditor;
	}
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
					<div class="font-mono text-xs font-medium text-zinc-100">hydra</div>
				</div>

				<button
					class="rounded p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
					onclick={toggleEditor}
					title="Edit code"
				>
					<Icon icon="lucide:code" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="relative">
				{#each $hydraSourcesMap[nodeId] as source, index}
					{#if source !== null}
						<Handle
							type="target"
							position={Position.Top}
							id={`video-in-${index}-s${source}`}
							style={`left: ${80 + index * 20}px;`}
							title={`Video source ${index + 1}, Hydra s${source}`}
							class="!border-orange-400 !bg-orange-500 hover:!bg-orange-400"
						/>
					{/if}
				{/each}

				<Handle
					type="target"
					position={Position.Top}
					class="z-1 !left-32"
					id="message-in"
					title="Message input"
				/>

				<canvas
					bind:this={previewCanvas}
					class={[
						'rounded-md border',
						selected
							? 'border-zinc-200 [&>canvas]:rounded-[7px]'
							: 'border-transparent [&>canvas]:rounded-md'
					]}
				></canvas>

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
					class="z-1 !left-28"
				/>
			</div>
		</div>
	</div>

	{#if showEditor}
		<div class="relative">
			<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
				<button onclick={updateHydra} class="rounded p-1 hover:bg-zinc-700">
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
					language="javascript"
					placeholder="Write your Hydra code here..."
					class="nodrag h-64 w-full resize-none"
					onrun={updateHydra}
				/>
			</div>
		</div>
	{/if}
</div>
