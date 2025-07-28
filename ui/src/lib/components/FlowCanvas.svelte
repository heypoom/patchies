<script lang="ts">
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import FlowCanvasInner from './FlowCanvasInner.svelte';
	import FpsMonitor from './FpsMonitor.svelte';
</script>

<SvelteFlowProvider>
	<FlowCanvasInner />

	<FpsMonitor />
</SvelteFlowProvider>
