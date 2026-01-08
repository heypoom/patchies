<script lang="ts">
	import { ChevronUp, Edit } from '@lucide/svelte/icons';
	import { useSvelteFlow } from '@xyflow/svelte';


	import hljs from 'highlight.js/lib/core';
	import javascript from 'highlight.js/lib/languages/javascript';

	import 'highlight.js/styles/tokyo-night-dark.css';
	import CodeEditor from '../CodeEditor.svelte';

	hljs.registerLanguage('javascript', javascript);

	let {
		id: nodeId,
		data,
		selected
	}: { id: string; data: { message: string }; selected: boolean } = $props();

	const { updateNodeData } = useSvelteFlow();

	let showTextInput = $state(false);
	let msgText = $derived(data.message || '');

	const containerClass = $derived(
		selected ? 'object-container-selected' : 'object-container-light'
	);
</script>

<div class="relative">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div></div>
				<button
					class="rounded p-1 transition-opacity hover:bg-zinc-700 group-hover:opacity-100 sm:opacity-0"
					onclick={() => (showTextInput = !showTextInput)}
					title="Toggle Message Input"
				>
					<svelte:component this={showTextInput ? ChevronUp : Edit}
						class="h-4 w-4 text-zinc-300"
					/>
				</button>
			</div>

			<div class="relative">
				<div class="relative">
					{#if showTextInput}
						<div
							class={[
								'nodrag w-full min-w-[40px] resize-none rounded-lg border font-mono text-zinc-200',
								containerClass
							]}
						>
							<CodeEditor
								value={msgText}
								onchange={(value) => updateNodeData(nodeId, { message: value })}
								language="plain"
								class="message-node-code-editor rounded-lg border !border-transparent focus:outline-none"
							/>
						</div>
					{:else}
						<button
							ondblclick={(e) => {
								e.preventDefault();
								e.stopPropagation();

								showTextInput = true;
							}}
							class={[
								'send-message-button whitespace-pre rounded-lg border px-3 py-2 text-start text-xs font-medium text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50',
								containerClass
							]}
						>
							{msgText ? msgText : '<label>'}
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	:global(.message-node-code-editor .cm-content) {
		padding: 6px 8px 7px 4px !important;
	}

	.send-message-button {
		font-family:
			Monaco,
			Menlo,
			Ubuntu Mono,
			Consolas,
			source-code-pro,
			monospace;
	}
</style>
