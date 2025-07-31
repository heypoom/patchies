<script lang="ts">
	import FlowCanvas from '$lib/components/FlowCanvas.svelte';
	import RenderWorker from '$workers/rendering/renderWorker.ts?worker';
	import { onMount } from 'svelte';
	import { buildRenderGraph } from '$lib/rendering/graphUtils.js';

	let worker: Worker | null = null;

	// Test data - some mock GLSL nodes
	const testNodes = [
		{ id: 'n1', type: 'glsl', data: { shader: 'void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }' } },
		{ id: 'n2', type: 'p5', data: { code: 'background(255);' } },
		{ id: 'n3', type: 'glsl', data: { shader: 'void main() { gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0); }' } },
		{ id: 'n4', type: 'glsl', data: { shader: 'void main() { gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0); }' } }
	];

	const testEdges = [
		{ id: 'e1', source: 'n1', target: 'n3' },
		{ id: 'e2', source: 'n3', target: 'n4' },
		{ id: 'e3', source: 'n2', target: 'n4' } // This edge will be filtered out (p5 -> glsl)
	];

	function testRenderGraph() {
		console.log('Testing render graph building...');
		
		const renderGraph = buildRenderGraph(testNodes, testEdges);
		console.log('Built render graph:', renderGraph);
		
		// Send to worker
		if (worker) {
			worker.postMessage({
				type: 'buildRenderGraph',
				graph: renderGraph
			});
		}
	}

	function testRenderFrame() {
		console.log('Testing frame rendering...');
		if (worker) {
			worker.postMessage({
				type: 'renderFrame',
				timestamp: Date.now()
			});
		}
	}

	onMount(() => {
		// Create worker using Vite's constructor import
		worker = new RenderWorker();

		// Listen for messages from worker
		worker.onmessage = (event) => {
			console.log('Main thread received:', event.data);
		};

		// Send test message to worker
		worker.postMessage({ type: 'test', message: 'Hello from main thread!' });

		// Test render graph building after a short delay
		setTimeout(testRenderGraph, 1000);

		return () => {
			worker?.terminate();
		};
	});
</script>

<div class="relative">
	<FlowCanvas />
	
	<!-- Test buttons -->
	<div class="fixed top-4 right-4 flex gap-2 z-50">
		<button 
			class="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
			onclick={testRenderGraph}
		>
			Build Graph
		</button>
		<button 
			class="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
			onclick={testRenderFrame}
		>
			Render Frame
		</button>
	</div>
</div>
