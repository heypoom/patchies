<script lang="ts">
	import Icon from '@iconify/svelte';
	import AboutTab from './AboutTab.svelte';
	import ExamplesTab from './ExamplesTab.svelte';
	import type { Tab } from './types';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let activeTab = $state<Tab>('about');

	function handleClose() {
		open = false;
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			handleClose();
		}
	}

	function handleOpen() {
		open = true;
	}
</script>

<!-- Help button trigger -->
<button
	onclick={handleOpen}
	class="cursor-pointer rounded bg-zinc-900/70 p-1 hover:bg-zinc-700"
	title="Help and examples"
>
	<Icon icon="lucide:help-circle" class="h-4 w-4 text-zinc-300" />
</button>

{#if open}
	<!-- Modal backdrop (no visual backdrop, just for click handling) -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center font-mono"
		onclick={handleBackdropClick}
		role="presentation"
	>
		<!-- Modal container -->
		<div
			class="relative h-[85vh] w-full max-w-3xl overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950/90 shadow-2xl backdrop-blur-lg"
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-title"
		>
			<!-- Close button -->
			<button
				onclick={handleClose}
				class="absolute top-4 right-4 z-10 rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
				aria-label="Close modal"
			>
				<Icon icon="lucide:x" class="h-5 w-5" />
			</button>

			<!-- Tab navigation -->
			<div class="border-b border-zinc-800 px-6 pt-6">
				<nav class="flex gap-6">
					<button
						onclick={() => (activeTab = 'about')}
						class="pb-3 text-sm font-medium transition-colors {activeTab === 'about'
							? 'border-b-2 border-orange-500 text-orange-500'
							: 'text-zinc-400 hover:text-zinc-200'}"
					>
						About
					</button>
					<button
						onclick={() => (activeTab = 'examples')}
						class="pb-3 text-sm font-medium transition-colors {activeTab === 'examples'
							? 'border-b-2 border-orange-500 text-orange-500'
							: 'text-zinc-400 hover:text-zinc-200'}"
					>
						Examples
					</button>
				</nav>
			</div>

			<!-- Tab content -->
			<div class="overflow-y-auto p-6" style="max-height: calc(85vh - 80px);">
				{#if activeTab === 'about'}
					<AboutTab />
				{:else if activeTab === 'examples'}
					<ExamplesTab />
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	/* Custom scrollbar styling */
	:global(.overflow-y-auto::-webkit-scrollbar) {
		width: 8px;
	}

	:global(.overflow-y-auto::-webkit-scrollbar-track) {
		background: rgb(39 39 42); /* zinc-800 */
	}

	:global(.overflow-y-auto::-webkit-scrollbar-thumb) {
		background: rgb(63 63 70); /* zinc-700 */
		border-radius: 4px;
	}

	:global(.overflow-y-auto::-webkit-scrollbar-thumb:hover) {
		background: rgb(82 82 91); /* zinc-600 */
	}
</style>
