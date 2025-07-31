<script lang="ts">
	import FlowCanvas from '$lib/components/FlowCanvas.svelte';
	import RenderWorker from '$workers/rendering/renderWorker.ts?worker';
	import { onMount } from 'svelte';

	let worker: Worker | null = null;

	onMount(() => {
		// Create worker using Vite's constructor import
		worker = new RenderWorker();
		
		// Listen for messages from worker
		worker.onmessage = (event) => {
			console.log('Main thread received:', event.data);
		};
		
		// Send test message to worker
		worker.postMessage({ type: 'test', message: 'Hello from main thread!' });
		
		return () => {
			worker?.terminate();
		};
	});
</script>

<FlowCanvas />
