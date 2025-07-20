<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { GLSLCanvasManager } from '$lib/canvas/GLSLCanvasManager';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import { VideoSystem } from '$lib/video/VideoSystem';
	import { MessageContext } from '$lib/messages/MessageContext';

	// Get node data from XY Flow - nodes receive their data as props
	let { id: nodeId }: { id: string } = $props();

	let containerElement: HTMLDivElement;
	let canvasManager: GLSLCanvasManager | null = null;
	let messageContext: MessageContext;
	let videoSystem: VideoSystem;
	let showEditor = $state(false);
	let code = $state(`// Available uniforms: iResolution, iTime, iMouse, iChannel0-3

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec3 color = vec3(0.0);
    float time = iTime * 0.5;
    
    color.r = sin(uv.x * 10.0 + time) * 0.5 + 0.5;
    color.g = sin(uv.y * 10.0 + time * 1.2) * 0.5 + 0.5;
    color.b = sin((uv.x + uv.y) * 5.0 + time * 0.8) * 0.5 + 0.5;
    
    float brightness = sin(time * 2.0) * 0.2 + 0.8;
    color *= brightness;
    fragColor = vec4(color, 1.0);
}`);

	onMount(() => {
		// Initialize message context and video system
		messageContext = new MessageContext(nodeId);
		videoSystem = VideoSystem.getInstance();

		// Subscribe to video canvas sources - GLSL needs to handle multiple channels
		videoSystem.onVideoCanvas(nodeId, (canvases) => {
			if (canvasManager) {
				// Pass all canvases to GLSL manager for iChannel0-3
				canvasManager.setVideoCanvases(canvases);
			}
		});

		if (containerElement) {
			canvasManager = new GLSLCanvasManager(containerElement);
			canvasManager.createCanvas({ code });
			registerVideoSource();
		}
	});

	onDestroy(() => {
		if (canvasManager) {
			canvasManager.destroy();
		}
		if (messageContext) {
			messageContext.destroy();
		}
		if (videoSystem) {
			videoSystem.unregisterNode(nodeId);
		}
	});

	function updateShader() {
		if (canvasManager) {
			canvasManager.updateCode(code);
		}
	}

	function toggleEditor() {
		showEditor = !showEditor;
	}

	function registerVideoSource() {
		if (canvasManager && videoSystem) {
			const canvas = canvasManager.getCanvas();
			if (canvas) {
				videoSystem.registerVideoSource(nodeId, canvas);
			}
		}
	}
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
					<div class="font-mono text-xs font-medium text-zinc-100">glsl.canvas</div>
				</div>

				<button
					class="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700"
					onclick={toggleEditor}
					title="Edit code"
				>
					<Icon icon="lucide:code" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="relative">
				<Handle type="target" position={Position.Top} />

				<!-- 4 video inlets for iChannel0-3 -->
				<VideoHandle
					type="target"
					position={Position.Top}
					id="video-in-0"
					class="!left-8"
					title="Video input iChannel0"
				/>
				<VideoHandle
					type="target"
					position={Position.Top}
					id="video-in-1"
					class="!left-12"
					title="Video input iChannel1"
				/>
				<VideoHandle
					type="target"
					position={Position.Top}
					id="video-in-2"
					class="!left-16"
					title="Video input iChannel2"
				/>
				<VideoHandle
					type="target"
					position={Position.Top}
					id="video-in-3"
					class="!left-20"
					title="Video input iChannel3"
				/>

				<div
					bind:this={containerElement}
					class="rounded-md bg-zinc-900 [&>canvas]:rounded-md"
				></div>

				<Handle type="source" position={Position.Bottom} />
				<VideoHandle
					type="source"
					position={Position.Bottom}
					id="video-out"
					class="!left-8"
					title="Video output"
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
					bind:value={code}
					language="glsl"
					placeholder="Write your GLSL fragment shader here..."
					class="nodrag h-64 w-full resize-none"
					onrun={updateShader}
				/>
			</div>
		</div>
	{/if}
</div>
