<script lang="ts">
	import { useUpdateNodeInternals } from '@xyflow/svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import * as Tooltip from '$lib/components/ui/tooltip';

	let {
		nodeId,
		nodeName,
		data,
		selected,
		onCodeChange,
		onRun,
		handleMessage,
		actionButtons
	}: {
		nodeId: string;
		nodeName: string;
		data: {
			code: string;
			messageInletCount?: number;
			messageOutletCount?: number;
		};
		selected: boolean;
		onCodeChange: (code: string) => void;
		onRun: () => void;
		handleMessage: MessageCallbackFn;
		actionButtons?: any;
	} = $props();

	let contentContainer: HTMLDivElement | null = null;
	let showEditor = $state(false);
	let contentWidth = $state(10);
	let messageContext: MessageContext;

	const updateNodeInternals = useUpdateNodeInternals();

	const code = $derived(data.code || '');
	const messageInletCount = $derived(data.messageInletCount || 0);
	const messageOutletCount = $derived(data.messageOutletCount || 0);

	const containerClass = $derived.by(() => {
		if (selected) return 'border-zinc-400 bg-zinc-800';
		return 'border-zinc-700 bg-zinc-900';
	});

	function handleCodeChangeInternal(newCode: string) {
		onCodeChange(newCode);

		setTimeout(() => {
			updateNodeInternals(nodeId);
			updateContentWidth();
		}, 10);
	}

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);
		updateContentWidth();
	});

	onDestroy(() => {
		messageContext.queue.removeCallback(handleMessage);
		messageContext.destroy();
	});

	function updateContentWidth() {
		if (!contentContainer) return;
		contentWidth = contentContainer.offsetWidth;
	}

	function toggleEditor() {
		showEditor = !showEditor;
	}

	let minContainerWidth = $derived.by(() => {
		const baseWidth = 20;
		let inletWidth = 20;
		return baseWidth + (1 + messageInletCount) * inletWidth;
	});
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2" bind:this={contentContainer}>
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div></div>

				<div>
					{@render actionButtons?.()}

					<button
						class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
						onclick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							toggleEditor();
						}}
						title="Edit code"
					>
						<Icon icon="lucide:code" class="h-4 w-4 text-zinc-300" />
					</button>
				</div>
			</div>

			<div class="relative">
				<!-- Total inlets = 1 audio inlet + message inlets -->
				<div>
					<!-- Audio input (always present) -->
					<StandardHandle
						port="inlet"
						type="audio"
						title="Audio Input"
						total={1 + messageInletCount}
						index={0}
						class="top-0"
					/>

					<!-- Message inlets (only show if messageInletCount > 0) -->
					{#if messageInletCount > 0}
						{#each Array.from({ length: messageInletCount }) as _, index (index)}
							<StandardHandle
								port="inlet"
								type="message"
								id={index}
								title={`Message Inlet ${index + 1}`}
								total={1 + messageInletCount}
								index={1 + index}
								class="top-0"
							/>
						{/each}
					{/if}
				</div>

				<button
					class={['cursor-pointer rounded-lg border px-3 py-2', containerClass]}
					style={`min-width: ${minContainerWidth}px`}
					ondblclick={(e) => {
						e.stopPropagation();
						e.preventDefault();
						toggleEditor();
					}}
					title="Double click to edit code"
				>
					<div class="flex items-center justify-center">
						<div class="font-mono text-xs text-zinc-300">{nodeName}</div>
					</div>
				</button>

				<div>
					<!-- Audio output (always present) -->
					<StandardHandle
						port="outlet"
						type="audio"
						title="Audio Output"
						total={1 + messageOutletCount}
						index={0}
						class="bottom-0"
					/>

					<!-- Message outlets (only show if messageOutletCount > 0) -->
					{#if messageOutletCount > 0}
						{#each Array.from({ length: messageOutletCount }) as _, index (index)}
							<StandardHandle
								port="outlet"
								type="message"
								id={index}
								title={`Message Outlet ${index + 1}`}
								total={1 + messageOutletCount}
								index={1 + index}
								class="bottom-0"
							/>
						{/each}
					{/if}
				</div>
			</div>
		</div>
	</div>

	{#if showEditor}
		<div class="absolute" style="left: {contentWidth + 10}px">
			<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
				<Tooltip.Root>
					<Tooltip.Trigger>
						<button onclick={onRun} class="rounded p-1 hover:bg-zinc-700">
							<Icon icon="lucide:play" class="h-4 w-4 text-zinc-300" />
						</button>
					</Tooltip.Trigger>
					<Tooltip.Content>
						<p>Run Code (shift+enter)</p>
					</Tooltip.Content>
				</Tooltip.Root>

				<button onclick={() => (showEditor = false)} class="rounded p-1 hover:bg-zinc-700">
					<Icon icon="lucide:x" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
				<CodeEditor
					value={code}
					onchange={handleCodeChangeInternal}
					language="javascript"
					class="nodrag h-64 w-full resize-none"
					onrun={onRun}
				/>
			</div>
		</div>
	{/if}
</div>
