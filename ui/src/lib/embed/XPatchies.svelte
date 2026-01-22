<svelte:options
	customElement={{
		tag: 'x-patchies',
		shadow: 'none'
	}}
/>

<script lang="ts">
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import FlowCanvasInner from '../components/FlowCanvasInner.svelte';
	import FpsMonitor from '../components/FpsMonitor.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import '../../app.css';
</script>

<div class="x-patchies-root dark">
	<Tooltip.Provider>
		<SvelteFlowProvider>
			<FlowCanvasInner />
			<FpsMonitor />
		</SvelteFlowProvider>
	</Tooltip.Provider>
</div>

<style>
	.x-patchies-root {
		width: 100%;
		height: 100%;
		position: relative;
	}
</style>
