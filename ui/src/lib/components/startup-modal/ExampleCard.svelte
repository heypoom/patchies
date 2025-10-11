<script lang="ts">
	import type { ExamplePatch } from './types';

	let { patch, onLoad }: { patch: ExamplePatch; onLoad: (id: string) => void } = $props();
</script>

<button
	onclick={() => onLoad(patch.id)}
	class="group relative cursor-pointer overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800/50 text-left transition-all hover:border-orange-500 hover:bg-zinc-800"
>
	{#if patch.imageUrl}
		<div class="aspect-video w-full overflow-hidden bg-zinc-900">
			<img
				src={patch.imageUrl}
				alt={patch.name}
				class="h-full w-full object-cover transition-transform group-hover:scale-105"
			/>
		</div>
	{:else}
		<div class="aspect-video w-full bg-gradient-to-br from-zinc-800 to-zinc-900"></div>
	{/if}
	<div class="p-3">
		<h3 class="font-medium text-zinc-100 group-hover:text-orange-500">
			{patch.name}
		</h3>
		{#if patch.description}
			<p class="mt-1 text-xs text-zinc-400">
				{patch.description}
			</p>
		{/if}
		{#if patch.author}
			<p class="mt-2 text-xs text-zinc-500">
				by {patch.author}
			</p>
		{/if}
	</div>
</button>
