<script lang="ts">
	import { ChevronUp, Edit } from '@lucide/svelte/icons';
	import { useSvelteFlow } from '@xyflow/svelte';

	import hljs from 'highlight.js/lib/core';
	import javascript from 'highlight.js/lib/languages/javascript';

	import 'highlight.js/styles/tokyo-night-dark.css';

	hljs.registerLanguage('javascript', javascript);

	let {
		id: nodeId,
		data,
		selected
	}: { id: string; data: { displayText: string; url: string }; selected: boolean } = $props();

	const { updateNodeData } = useSvelteFlow();

	let showTextInput = $state(false);
	let displayText = $derived(data.displayText || '');
	let url = $derived(data.url || '');

	const containerClass = $derived(
		selected ? 'object-container-selected' : 'object-container-light'
	);

	function handleLinkClick() {
		if (!url) return;

		const confirmed = confirm(`Do you want to open this link: ${url}?`);
		if (!confirmed) return;

		// for internal patchies url, open in the same tab.
		if (url.startsWith(location.origin)) {
			location.href = url;
			return;
		}

		window.open(url, '_blank');
	}
</script>

<div class="relative">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div></div>
				<button
					class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
					onclick={() => (showTextInput = !showTextInput)}
					title="Configure Link"
				>
					<svelte:component this={showTextInput ? ChevronUp : Edit} class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="relative">
				<div class="relative">
					{#if showTextInput}
						<div
							class={[
								'nodrag w-full min-w-[200px] resize-none rounded-lg border font-mono text-zinc-200',
								containerClass
							]}
						>
							<div class="space-y-3 p-3">
								<div>
									<label class="mb-1 block text-xs text-zinc-400" for="text">Display Text</label>

									<input
										type="text"
										value={displayText}
										onchange={(e) => updateNodeData(nodeId, { displayText: e.currentTarget.value })}
										placeholder="Link text"
										class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
									/>
								</div>
								<div>
									<label class="mb-1 block text-xs text-zinc-400" for="url">URL</label>

									<input
										type="url"
										value={url}
										onchange={(e) => updateNodeData(nodeId, { url: e.currentTarget.value })}
										placeholder="https://example.com"
										class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
									/>
								</div>
							</div>
						</div>
					{:else}
						<button
							ondblclick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								handleLinkClick();
							}}
							class={[
								'link-button cursor-pointer rounded-lg border px-3 py-2 text-start text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800 active:bg-zinc-700',
								containerClass
							]}
						>
							{displayText || url || '<link>'}
						</button>
					{/if}
				</div>

				<div
					class={[
						'pointer-events-none absolute mt-1 ml-1 w-fit min-w-[200px] font-mono text-[8px] text-zinc-300',
						selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
					]}
				>
					<div>double click to open link.</div>
					<div>links to <span class="text-blue-200">{url}</span></div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.link-button {
		font-family: var(--font-mono);
	}
</style>
