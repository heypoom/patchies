<script lang="ts">
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import FlowCanvasInner from './FlowCanvasInner.svelte';
	import FpsMonitor from './FpsMonitor.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
</script>

<Tooltip.Provider>
	<SvelteFlowProvider>
		<FlowCanvasInner />

		<FpsMonitor />
	</SvelteFlowProvider>
</Tooltip.Provider>
