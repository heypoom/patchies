<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { GLSLCanvasManager } from '$lib/canvas/GLSLCanvasManager';
	import CodeEditor from '$lib/components/CodeEditor.svelte';

	let containerElement: HTMLDivElement;
	let canvasManager: GLSLCanvasManager | null = null;
	let showEditor = $state(false);
	let code = $state(`// GLSL Fragment Shader (ShaderToy compatible)
// Available uniforms: iResolution, iTime, iMouse, iDate, iTimeDelta, iFrame

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // Normalize coordinates (0.0 to 1.0)
    vec2 uv = fragCoord / iResolution.xy;
    
    // Create animated gradient
    vec3 color = vec3(0.0);
    
    // Add time-based animation
    float time = iTime * 0.5;
    
    // Create colorful waves
    color.r = sin(uv.x * 10.0 + time) * 0.5 + 0.5;
    color.g = sin(uv.y * 10.0 + time * 1.2) * 0.5 + 0.5;
    color.b = sin((uv.x + uv.y) * 5.0 + time * 0.8) * 0.5 + 0.5;
    
    // Add some brightness variation
    float brightness = sin(time * 2.0) * 0.2 + 0.8;
    color *= brightness;
    
    fragColor = vec4(color, 1.0);
}

// Try these examples:
// Simple circle:
// float d = distance(uv, vec2(0.5));
// color = vec3(smoothstep(0.3, 0.29, d));

// Rotating pattern:
// float angle = atan(uv.y - 0.5, uv.x - 0.5) + iTime;
// color = vec3(sin(angle * 6.0) * 0.5 + 0.5);`);

	onMount(() => {
		if (containerElement) {
			canvasManager = new GLSLCanvasManager(containerElement);
			canvasManager.createCanvas({ code });
		}
	});

	onDestroy(() => {
		if (canvasManager) {
			canvasManager.destroy();
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
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
					<div class="font-mono text-xs font-medium text-zinc-100">glsl.canvas</div>
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
				<Handle type="target" position={Position.Top} />

				<div
					bind:this={containerElement}
					class="rounded-md bg-zinc-900 [&>canvas]:rounded-md"
				></div>

				<Handle type="source" position={Position.Bottom} />
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

<style>
	:global(.svelte-flow__handle) {
		background: rgb(156 163 175) !important;
		border: 2px solid rgb(75 85 99) !important;
		width: 8px !important;
		height: 8px !important;
	}

	:global(.svelte-flow__handle.svelte-flow__handle-top) {
		top: 0 !important;
	}

	:global(.svelte-flow__handle.svelte-flow__handle-bottom) {
		bottom: 0 !important;
	}
</style>
