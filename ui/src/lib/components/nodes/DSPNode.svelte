<script lang="ts">
	import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { AudioSystem } from '$lib/audio/AudioSystem';
	import { parseInletCount } from '$lib/utils/expr-parser';
	import * as Tooltip from '$lib/components/ui/tooltip';

	let contentContainer: HTMLDivElement | null = null;

	// Get node data from XY Flow - nodes receive their data as props
	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: {
			code: string;
			messageInletCount?: number;
		};
		selected: boolean;
	} = $props();

	// Get flow utilities to update node data
	const { updateNodeData } = useSvelteFlow();
	const updateNodeInternals = useUpdateNodeInternals();

	let messageContext: MessageContext;
	let audioSystem = AudioSystem.getInstance();
	let inletValues = $state<unknown[]>([]);
	let showEditor = $state(false);
	let contentWidth = $state(100);

	const code = $derived(data.code || '');
	const messageInletCount = $derived(data.messageInletCount || 0);

	const placeholderCode = `function process(inputs, outputs) {
  // White noise example
  outputs[0].forEach((channel) => {
    for (let i = 0; i < channel.length; i++) {
      channel[i] = Math.random() * 2 - 1;
    }
  });
}`;

	const valueInletCount = $derived.by(() => {
		if (!code.trim()) return 0;

		return parseInletCount(code.trim());
	});

	const containerClass = $derived.by(() => {
		if (selected) return 'border-zinc-400 bg-zinc-800';
		return 'border-zinc-700 bg-zinc-900';
	});

	const handleMessage: MessageCallbackFn = (message, meta) => {
		const nextInletValues = [...inletValues];

		match(message)
			.with({ type: P.union('run') }, () => {
				runDSP();
			})
			.with(P.any, (value) => {
				if (meta?.inlet === undefined) return;

				// Check if this is a value inlet
				const isValueInlet =
					valueInletCount > 0 && meta.inlet >= 0 && meta.inlet <= valueInletCount - 1;

				// Check if this is a message inlet
				const isMessageInlet =
					messageInletCount > 0 &&
					meta.inlet > valueInletCount - 1 &&
					meta.inlet <= valueInletCount + messageInletCount;

				if (isValueInlet) {
					const valueInletIndex = meta.inlet;
					nextInletValues[valueInletIndex] = value;
					inletValues = nextInletValues;
					updateAudioInletValues(nextInletValues);
				} else if (isMessageInlet) {
					const messageInletIndex = meta.inlet - valueInletCount;

					audioSystem.send(nodeId, 'messageInlet', {
						inletIndex: messageInletIndex,
						message,
						meta
					});
				}
			});
	};

	const updateAudioCode = (code: string) => audioSystem.send(nodeId, 'code', code);

	const updateAudioInletValues = (values: unknown[]) =>
		audioSystem.send(nodeId, 'inletValues', values);

	function handleCodeChange(newCode: string) {
		updateNodeData(nodeId, { code: newCode });

		const newInletCount = parseInletCount(newCode || '');

		if (newInletCount !== inletValues.length) {
			inletValues = new Array(newInletCount).fill(0);
			updateAudioInletValues(inletValues);
		}

		setTimeout(() => {
			updateNodeInternals(nodeId);
			updateContentWidth();
		}, 5);
	}

	function runDSP() {
		updateAudioCode(code);
	}

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);

		inletValues = new Array(valueInletCount).fill(0);
		audioSystem.createAudioObject(nodeId, 'dsp~', [null, code]);
		updateAudioInletValues(inletValues);
		updateContentWidth();

		setTimeout(() => {
			const dspNode = audioSystem.nodesById.get(nodeId);
			if (!dspNode || dspNode.type !== 'dsp~') return;

			dspNode.node.port.onmessage = (event: MessageEvent) => {
				if (event.data.type === 'port-count-changed') {
					updateNodeData(nodeId, {
						code: data.code,
						messageInletCount: event.data.messageInletCount
					});

					setTimeout(() => {
						updateNodeInternals(nodeId);
						updateContentWidth();
					}, 5);
				}
			};
		}, 100);
	});

	onDestroy(() => {
		messageContext.queue.removeCallback(handleMessage);
		messageContext.destroy();
		audioSystem.removeAudioObject(nodeId);
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

		return baseWidth + (1 + valueInletCount + messageInletCount) * inletWidth;
	});
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2" bind:this={contentContainer}>
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div></div>

				<div>
					<button
						class="rounded p-1 transition-opacity hover:bg-zinc-700 group-hover:opacity-100 sm:opacity-0"
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
				<!-- Total inlets = 1 audio inlet + control inlets + message inlets -->
				<div>
					<!-- Audio input (always present) -->
					<StandardHandle
						port="inlet"
						type="audio"
						title="Audio Input"
						total={1 + valueInletCount + messageInletCount}
						index={0}
						class="top-0"
					/>

					<!-- Control inlets for $1-$9 variables (only show if there are $ variables) -->
					{#if valueInletCount > 0}
						{#each Array.from({ length: valueInletCount }) as _, index}
							<StandardHandle
								port="inlet"
								type="message"
								id={index}
								title={`$${index + 1}`}
								total={1 + valueInletCount + messageInletCount}
								index={index + 1}
								class="top-0"
							/>
						{/each}
					{/if}

					<!-- Message inlets (only show if messageInletCount > 0) -->
					{#if messageInletCount > 0}
						{#each Array.from({ length: messageInletCount }) as _, index}
							<StandardHandle
								port="inlet"
								type="message"
								id={valueInletCount + index}
								title={`Message Inlet ${index + 1}`}
								total={1 + valueInletCount + messageInletCount}
								index={1 + valueInletCount + index}
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
						<div class="font-mono text-xs text-zinc-300">dsp~</div>
					</div>
				</button>

				<div>
					<!-- Audio output -->
					<StandardHandle
						port="outlet"
						type="audio"
						title="Audio Output"
						total={1}
						index={0}
						class="bottom-0"
					/>
				</div>
			</div>
		</div>
	</div>

	{#if showEditor}
		<div class="absolute" style="left: {contentWidth + 10}px">
			<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
				<Tooltip.Root>
					<Tooltip.Trigger>
						<button onclick={runDSP} class="rounded p-1 hover:bg-zinc-700">
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
					onchange={handleCodeChange}
					language="javascript"
					placeholder={placeholderCode}
					class="nodrag h-64 w-full resize-none"
					onrun={runDSP}
				/>
			</div>
		</div>
	{/if}
</div>
