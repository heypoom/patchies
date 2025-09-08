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
		};
		selected: boolean;
	} = $props();

	// Get flow utilities to update node data
	const { updateNodeData } = useSvelteFlow();
	const updateNodeInternals = useUpdateNodeInternals();

	let messageContext: MessageContext;
	let audioSystem = AudioSystem.getInstance();
	let inletValues = $state<number[]>([]);
	let showEditor = $state(false);
	let contentWidth = $state(100);

	const code = $derived(data.code || '');

	const placeholderCode = `function process(inputs, outputs) {
  // White noise example
  outputs[0].forEach((channel) => {
    for (let i = 0; i < channel.length; i++) {
      channel[i] = Math.random() * 2 - 1;
    }
  });
}`;

	const inletCount = $derived.by(() => {
		if (!code.trim()) return 0;
		return parseInletCount(code.trim());
	});

	const borderColor = $derived.by(() => {
		if (selected) return 'border-zinc-400';
		return 'border-zinc-600';
	});

	const handleMessage: MessageCallbackFn = (message, meta) => {
		const nextInletValues = [...inletValues];

		match(message)
			.with(P.union(P.number), (value) => {
				if (meta?.inlet === undefined) return;

				nextInletValues[meta.inlet] = value;
				inletValues = nextInletValues;

				updateAudioInletValues(nextInletValues);
			})
			.with({ type: 'run' }, () => {
				runDSP();
			});
	};

	const updateAudioCode = (code: string) => audioSystem.send(nodeId, 'code', code);

	const updateAudioInletValues = (values: number[]) =>
		audioSystem.send(nodeId, 'inletValues', values);

	function handleCodeChange(newCode: string) {
		updateNodeData(nodeId, { code: newCode });

		// Update inlet count when code changes
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

		inletValues = new Array(inletCount).fill(0);
		audioSystem.createAudioObject(nodeId, 'dsp~', [null, code]);
		updateAudioInletValues(inletValues);

		updateContentWidth();
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
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2" bind:this={contentContainer}>
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div></div>

				<div>
					<button
						class="rounded p-1 transition-opacity hover:bg-zinc-700 group-hover:opacity-100 sm:opacity-0"
						onclick={toggleEditor}
						title="Edit code"
					>
						<Icon icon="lucide:code" class="h-4 w-4 text-zinc-300" />
					</button>
				</div>
			</div>

			<div class="relative">
				<!-- Total inlets = 1 audio inlet + control inlets -->
				<div>
					<!-- Audio input (always present) -->
					<StandardHandle
						port="inlet"
						type="audio"
						title="Audio Input"
						total={1 + inletCount}
						index={0}
						class="top-0"
					/>

					<!-- Control inlets for $1-$9 variables (only show if there are $ variables) -->
					{#if inletCount > 0}
						{#each Array.from({ length: inletCount }) as _, index}
							<StandardHandle
								port="inlet"
								type="message"
								title={`$${index + 1}`}
								total={1 + inletCount}
								index={index + 1}
								class="top-0"
							/>
						{/each}
					{/if}
				</div>

				<div class={['min-w-[80px] rounded-md border bg-zinc-900 px-3 py-2', borderColor]}>
					<div class="flex items-center justify-center">
						<div class="font-mono text-sm text-zinc-300">dsp~</div>
					</div>
				</div>

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
