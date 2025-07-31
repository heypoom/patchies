<script lang="ts">
	import FlowCanvas from '$lib/components/FlowCanvas.svelte';
</script>

<div class="relative">
	<FlowCanvas />
	
	<!-- Development links -->
	<div class="fixed right-4 top-4 z-50">
		<a 
			href="/fbo-test" 
			class="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
		>
			FBO Test
		</a>
	</div>
</div>