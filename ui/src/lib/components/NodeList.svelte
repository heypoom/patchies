<script lang="ts">
	import { ChevronUp, Plus } from '@lucide/svelte';
	import { isBackgroundOutputCanvasEnabled } from '../../stores/canvas.store';

	interface Props {
		nodeTypes: Record<string, any>;
		isVisible: boolean;
		onToggle: () => void;
	}

	let { nodeTypes, isVisible, onToggle }: Props = $props();
</script>

<div class={['fixed bottom-0 left-0 w-full bg-transparent px-2 py-1 transition-all duration-300']}>
	<div class="max-w-full">
		<div class="flex items-end">
			<!-- Toggle Button -->
			<button
				class={[
					'flex cursor-pointer items-center justify-end gap-1 rounded-lg px-2 py-1 text-[10px] transition-colors select-none',
					$isBackgroundOutputCanvasEnabled
						? 'bg-zinc-900/50 hover:bg-zinc-900/70'
						: 'border border-zinc-800 bg-zinc-900 hover:bg-zinc-800'
				]}
				onclick={onToggle}
				title={isVisible ? 'Hide node palette' : 'Show node palette'}
			>
				<Plus class="h-3 w-3" />
				<span class="font-mono text-zinc-300">objects</span>
				<ChevronUp class={`h-3 w-3 transition-transform ${isVisible ? '' : 'rotate-180'}`} />
			</button>

			{#if isVisible}
				<!-- Node List -->
				<div class="flex flex-wrap gap-2 pl-2">
					{#each Object.keys(nodeTypes) as nodeType}
						<div
							role="button"
							tabindex="0"
							class={[
								'flex cursor-grab flex-col items-center gap-2 rounded-lg px-[10px] py-[3px] transition-colors select-none',
								$isBackgroundOutputCanvasEnabled
									? 'bg-zinc-900/60 hover:bg-zinc-900'
									: 'border border-zinc-800 bg-zinc-900 hover:bg-zinc-700'
							]}
							draggable={true}
							ondragstart={(event) => {
								event.dataTransfer?.setData('application/svelteflow', nodeType);
							}}
						>
							<span class="font-mono text-[16px] text-zinc-300">{nodeType}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
