<script lang="ts">
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import FlowCanvasInner from './FlowCanvasInner.svelte';
</script>

<SvelteFlowProvider>
	<FlowCanvasInner />
</SvelteFlowProvider>
