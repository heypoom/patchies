<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<div class="dark">
	{@render children()}
</div>
