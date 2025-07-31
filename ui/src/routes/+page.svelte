<script lang="ts">
	import FlowCanvas from '$lib/components/FlowCanvas.svelte';
	import RenderWorker from '$workers/rendering/renderWorker.ts?worker';
	import { onMount } from 'svelte';
	import { buildRenderGraph } from '$lib/rendering/graphUtils.js';

	let worker: Worker | null = null;
	let outputCanvas: HTMLCanvasElement;

	// Test data - some mock GLSL nodes with proper ShaderToy format
	const testNodes = [
		{
			id: 'n1',
			type: 'glsl',
			data: {
				shader: `
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    fragColor = vec4(uv.x, 0.0, 0.0, 1.0); // Red gradient
}`
			}
		},
		{ id: 'n2', type: 'p5', data: { code: 'background(255);' } },
		{
			id: 'n3',
			type: 'glsl',
			data: {
				shader: `
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec4 inputColor = texture2D(iChannel0, uv);
    fragColor = vec4(inputColor.r, uv.y, 0.0, 1.0); // Mix input with green gradient
}`
			}
		},
		{
			id: 'n4',
			type: 'glsl',
			data: {
				shader: `
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec4 inputColor = texture2D(iChannel0, uv);
    float time = iTime * 0.5;
    vec3 color = inputColor.rgb;
    color.b += sin(uv.x * 10.0 + time) * 0.5 + 0.5; // Add animated blue
    fragColor = vec4(color, 1.0);
}`
			}
		}
	];

	const testEdges = [
		{ id: 'e1', source: 'n1', target: 'n3' },
		{ id: 'e2', source: 'n3', target: 'n4' },
		{ id: 'e3', source: 'n2', target: 'n4' } // This edge will be filtered out (p5 -> glsl)
	];

	function testRenderGraph() {
		const renderGraph = buildRenderGraph(testNodes, testEdges);

		// Send to worker
		if (worker) {
			worker.postMessage({
				type: 'buildRenderGraph',
				graph: renderGraph
			});
		}
	}

	function testRenderFrame() {
		if (worker) {
			worker.postMessage({
				type: 'renderFrame',
				timestamp: Date.now()
			});
		}
	}

	function startAnimation() {
		if (worker) {
			worker.postMessage({
				type: 'startAnimation'
			});
		}
	}

	function stopAnimation() {
		if (worker) {
			worker.postMessage({
				type: 'stopAnimation'
			});
		}
	}

	onMount(() => {
		// Create worker using Vite's constructor import
		worker = new RenderWorker();

		const bmr = outputCanvas.getContext('bitmaprenderer')!;

		// Listen for messages from worker
		worker.onmessage = (event) => {
			// Handle output bitmap from worker
			if (
				(event.data.type === 'frameRendered' || event.data.type === 'animationFrame') &&
				event.data.outputBitmap &&
				outputCanvas
			) {
				bmr.transferFromImageBitmap(event.data.outputBitmap);
			}
		};

		// Send test message to worker
		worker.postMessage({ type: 'test', message: 'Hello from main thread!' });

		// Test render graph building after a short delay
		setTimeout(testRenderGraph, 1000);

		// Test frame rendering after graph is built
		setTimeout(testRenderFrame, 2000);

		return () => {
			worker?.terminate();
		};
	});
</script>

<div class="relative">
	<FlowCanvas />

	<!-- Test buttons and output canvas -->
	<div class="fixed right-4 top-4 z-50 flex flex-col gap-2">
		<div class="flex gap-2">
			<button
				class="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
				onclick={testRenderGraph}
			>
				Build Graph
			</button>
			<button
				class="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
				onclick={testRenderFrame}
			>
				Render Frame
			</button>
		</div>
		<div class="flex gap-2">
			<button
				class="rounded bg-purple-600 px-3 py-1 text-sm text-white hover:bg-purple-700"
				onclick={startAnimation}
			>
				Start Animation
			</button>
			<button
				class="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
				onclick={stopAnimation}
			>
				Stop Animation
			</button>
		</div>

		<!-- Output canvas for worker rendering -->
		<canvas
			bind:this={outputCanvas}
			width="400"
			height="300"
			class="border border-gray-400 bg-black"
		></canvas>
	</div>
</div>
