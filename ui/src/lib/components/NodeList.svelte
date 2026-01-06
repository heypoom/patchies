<script lang="ts">
	import { Search } from '@lucide/svelte';
	import { isBackgroundOutputCanvasEnabled } from '../../stores/canvas.store';

	interface Props {
		onOpenBrowser: () => void;
	}

	let { onOpenBrowser }: Props = $props();
</script>

<div class="fixed bottom-0 left-0 px-2 py-1">
	<!-- Browse Objects Button -->
	<button
		class={[
			'flex cursor-pointer select-none items-center gap-1 rounded-lg px-2 py-1 text-[10px] transition-colors',
			$isBackgroundOutputCanvasEnabled
				? 'bg-zinc-900/50 hover:bg-zinc-900/70'
				: 'border border-zinc-800 bg-zinc-900 hover:bg-zinc-800'
		]}
		onclick={onOpenBrowser}
		title="Browse all objects"
	>
		<Search class="h-3 w-3" />

		<span class="font-mono text-zinc-300">objects</span>
	</button>
</div>
