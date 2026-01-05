<script lang="ts">
	import Icon from '@iconify/svelte';
	import AboutTab from './AboutTab.svelte';
	import ExamplesTab from './ExamplesTab.svelte';
	import LicenseTab from './LicenseTab.svelte';
	import ShortcutsTab from './ShortcutsTab.svelte';
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

	const tabs: Tab[] = ['about', 'examples', 'shortcuts', 'license'];
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
			class="relative h-screen w-full overflow-hidden bg-zinc-950/90 sm:mx-4 sm:h-[85vh] sm:max-w-3xl sm:rounded-lg sm:border sm:border-zinc-700 sm:shadow-2xl md:mx-8 lg:mx-12"
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-title"
		>
			<!-- Tab navigation -->
			<div class="relative border-b border-zinc-800 px-4 pt-4 sm:px-6 sm:pt-6">
				<div class="flex items-start gap-4">
					<nav class="flex flex-1 gap-4 overflow-x-auto sm:gap-6">
						{#each tabs as tab (tab)}
							<button
								onclick={() => (activeTab = tab)}
								class="flex-shrink-0 pb-3 text-sm font-medium transition-colors {activeTab === tab
									? 'border-b-2 border-orange-500 text-orange-500'
									: 'text-zinc-400 hover:text-zinc-200'}"
							>
								{tab}
							</button>
						{/each}
					</nav>
					<!-- Close button -->
					<button
						onclick={handleClose}
						class="flex-shrink-0 rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
						aria-label="Close modal"
					>
						<Icon icon="lucide:x" class="h-5 w-5" />
					</button>
				</div>
			</div>

			<!-- Tab content -->
			<div class="flex overflow-y-auto p-4 sm:p-6" style="max-height: calc(100vh - 80px);">
				{#if activeTab === 'about'}
					<AboutTab setTab={(tab) => (activeTab = tab)} />
				{:else if activeTab === 'examples'}
					<ExamplesTab />
				{:else if activeTab === 'license'}
					<LicenseTab setTab={(tab) => (activeTab = tab)} />
				{:else if activeTab === 'shortcuts'}
					<ShortcutsTab />
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
