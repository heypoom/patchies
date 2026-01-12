<script lang="ts">
	import { Code, Play, Terminal, X } from '@lucide/svelte/icons';
	import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { onMount, onDestroy } from 'svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext, type SendMessageOptions } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { AudioService } from '$lib/audio/v2/AudioService';
	import { parseInletCount } from '$lib/utils/expr-parser';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { DspNode } from '$lib/audio/v2/nodes/DspNode';
	import VirtualConsole from '$lib/components/VirtualConsole.svelte';
	import { logger } from '$lib/utils/logger';

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
			messageOutletCount?: number;
			audioInletCount?: number;
			audioOutletCount?: number;
			title?: string;
			executeCode?: number;
			showConsole?: boolean;
		};
		selected: boolean;
	} = $props();

	// Console and error tracking
	let consoleRef: VirtualConsole | null = $state(null);
	let lineErrors = $state<Record<number, string[]> | undefined>(undefined);
	let showConsole = $state(false);

	// Get flow utilities to update node data
	const { updateNodeData } = useSvelteFlow();
	const updateNodeInternals = useUpdateNodeInternals();

	let messageContext: MessageContext;
	let audioService = AudioService.getInstance();
	let inletValues = $state<unknown[]>([]);
	let showEditor = $state(false);
	let contentWidth = $state(100);
	let previousExecuteCode = $state<number | undefined>(undefined);

	// Watch for executeCode timestamp changes and re-run when it changes
	$effect(() => {
		if (data.executeCode && data.executeCode !== previousExecuteCode) {
			previousExecuteCode = data.executeCode;
			runDSP();
		}
	});

	const code = $derived(data.code || '');
	const messageInletCount = $derived(data.messageInletCount ?? 0);
	const messageOutletCount = $derived(data.messageOutletCount ?? 0);
	const audioInletCount = $derived(data.audioInletCount ?? 1);
	const audioOutletCount = $derived(data.audioOutletCount ?? 1);

	const valueInletCount = $derived.by(() => {
		if (!code.trim()) return 0;

		return parseInletCount(code.trim());
	});

	const containerClass = $derived.by(() => {
		if (selected) return 'object-container-selected';

		return 'object-container';
	});

	const handleMessage: MessageCallbackFn = (message, meta) => {
		const nextInletValues = [...inletValues];

		match(message)
			.with({ type: P.union('run') }, () => {
				runDSP();
			})
			.with(P.any, (value) => {
				if (meta?.inlet === undefined) return;

				// Determine inlet type based on handle ID pattern
				const handleId = meta.inletKey || '';
				const isAudioInlet = handleId.startsWith('audio-in');
				const isMessageInlet = handleId.startsWith('message-in');

				if (isAudioInlet) {
					// Audio inlets are handled by the audio service directly
					const audioInletIndex = meta.inlet;
					audioService.send(nodeId, 'audioInlet', {
						inletIndex: audioInletIndex,
						message,
						meta
					});
				} else if (isMessageInlet) {
					// Parse the message inlet ID to get the index
					const messageIdMatch = handleId.match(/message-in-(\d+)/);
					const messageInletId = messageIdMatch ? parseInt(messageIdMatch[1]) : 0;

					// Check if this is a value inlet (first valueInletCount message inlets)
					if (messageInletId < valueInletCount) {
						const valueInletIndex = messageInletId;
						nextInletValues[valueInletIndex] = value;
						inletValues = nextInletValues;
						updateAudioInletValues(nextInletValues);
					} else {
						// This is a message inlet
						const messageInletIndex = messageInletId - valueInletCount;

						audioService.send(nodeId, 'messageInlet', {
							inletIndex: messageInletIndex,
							message,
							meta
						});
					}
				}
			});
	};

	const updateAudioCode = (code: string) => audioService.send(nodeId, 'code', code);

	const updateAudioInletValues = (values: unknown[]) =>
		audioService.send(nodeId, 'inletValues', values);

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
		// Clear console and error highlighting on re-run
		consoleRef?.clearConsole();
		lineErrors = undefined;

		updateAudioCode(code);
	}

	function syncPortLayout() {
		setTimeout(() => {
			updateNodeInternals(nodeId);
			updateContentWidth();
		}, 5);
	}

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);

		inletValues = new Array(valueInletCount).fill(0);
		audioService.createNode(nodeId, 'dsp~', [null, code]);
		updateAudioInletValues(inletValues);
		updateContentWidth();
		setupWorkletEventHandler();
	});

	async function setupWorkletEventHandler() {
		const node = audioService.getNodeById(nodeId) as DspNode;
		if (!node) return;

		await node.ensureModule();

		const worklet = node.worklet;
		if (!worklet) return;

		worklet.port.onmessage = (event: MessageEvent) => {
			match(event.data)
				.with(
					{
						type: 'message-port-count-changed',
						messageInletCount: P.number,
						messageOutletCount: P.number
					},
					(m) => {
						updateNodeData(nodeId, {
							messageInletCount: m.messageInletCount,
							messageOutletCount: m.messageOutletCount
						});

						syncPortLayout();
					}
				)
				.with(
					{
						type: 'audio-port-count-changed',
						audioInletCount: P.number,
						audioOutletCount: P.number
					},
					(m) => {
						updateNodeData(nodeId, {
							audioInletCount: m.audioInletCount,
							audioOutletCount: m.audioOutletCount
						});

						syncPortLayout();
					}
				)
				.with({ type: 'set-title', value: P.string }, (m) => {
					updateNodeData(nodeId, { title: m.value });
				})
				.with({ type: 'set-keep-alive', enabled: P.boolean }, (m) => {
					node.send('setKeepAlive', m.enabled);
				})
				.with({ type: 'send-message', message: P.any, options: P.any }, (eventData) => {
					messageContext.send(eventData.message, eventData.options as SendMessageOptions);
				})
				.with(
					{ type: 'code-error', message: P.string, lineErrors: P.any, context: P.any },
					(errorData) => {
						// Show console on error
						showConsole = true;

						// Update line errors for code highlighting
						if (errorData.lineErrors) {
							lineErrors = errorData.lineErrors;
							logger.nodeError(nodeId, { lineErrors: errorData.lineErrors }, errorData.message);
						} else {
							logger.nodeError(nodeId, errorData.message);
						}
					}
				)
				.with({ type: 'console-output', level: P.string, args: P.array(P.any) }, (consoleData) => {
					const args = consoleData.args;

					// Route to the appropriate logger method
					match(consoleData.level)
						.with('error', () => logger.nodeError(nodeId, ...args))
						.with('warn', () => logger.nodeWarn(nodeId, ...args))
						.with('info', () => logger.nodeInfo(nodeId, ...args))
						.with('debug', () => logger.nodeDebug(nodeId, ...args))
						.otherwise(() => logger.nodeLog(nodeId, ...args));
				});
		};
	}

	onDestroy(() => {
		messageContext.queue.removeCallback(handleMessage);
		messageContext.destroy();
		audioService.removeNode(audioService.getNodeById(nodeId)!);
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

		return baseWidth + (audioInletCount + valueInletCount + messageInletCount) * inletWidth;
	});
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2" bind:this={contentContainer}>
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div></div>

				<div>
					<button
						class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
						onclick={(e) => {
							e.preventDefault();
							e.stopPropagation();

							toggleEditor();
						}}
						title="Edit code"
					>
						<Code class="h-4 w-4 text-zinc-300" />
					</button>
				</div>
			</div>

			<div class="relative">
				<!-- Total inlets = audio inlets + control inlets + message inlets -->
				<div>
					<!-- Audio inputs -->
					{#each Array.from({ length: audioInletCount }) as _, index}
						<StandardHandle
							port="inlet"
							type="audio"
							id={audioInletCount === 1 && index === 0 ? undefined : index}
							title={audioInletCount > 1 ? `Audio Input ${index + 1}` : 'Audio Input'}
							total={audioInletCount + valueInletCount + messageInletCount}
							{index}
							class="top-0"
							{nodeId}
						/>
					{/each}

					<!-- Control inlets for $1-$9 variables (only show if there are $ variables) -->
					{#if valueInletCount > 0}
						{#each Array.from({ length: valueInletCount }) as _, index}
							<StandardHandle
								port="inlet"
								type="message"
								id={index}
								title={`$${index + 1}`}
								total={audioInletCount + valueInletCount + messageInletCount}
								index={audioInletCount + index}
								class="top-0"
								{nodeId}
							/>
						{/each}
					{/if}

					<!-- Message inlets (only show if messageInletCount > 0) -->
					{#if messageInletCount > 0}
						{#each Array.from({ length: messageInletCount }) as _, index (index)}
							<StandardHandle
								port="inlet"
								type="message"
								id={valueInletCount + index}
								title={`Message Inlet ${index + 1}`}
								total={audioInletCount + valueInletCount + messageInletCount}
								index={audioInletCount + valueInletCount + index}
								class="top-0"
								{nodeId}
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
						<div class="font-mono text-xs text-zinc-300">{data.title ?? 'dsp~'}</div>
					</div>
				</button>

				<div>
					<!-- Audio outputs -->
					{#each Array.from({ length: audioOutletCount }) as _, index (index)}
						<StandardHandle
							port="outlet"
							type="audio"
							id={audioOutletCount === 1 && index === 0 ? undefined : index}
							title={audioOutletCount > 1 ? `Audio Output ${index + 1}` : 'Audio Output'}
							total={audioOutletCount + messageOutletCount}
							{index}
							class="bottom-0"
							{nodeId}
						/>
					{/each}

					<!-- Message outlets -->
					{#if messageOutletCount > 0}
						{#each Array.from({ length: messageOutletCount }) as _, index (index)}
							<StandardHandle
								port="outlet"
								type="message"
								id={index}
								title={`Message Outlet ${index + 1}`}
								total={audioOutletCount + messageOutletCount}
								index={audioOutletCount + index}
								{nodeId}
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
						<button onclick={runDSP} class="rounded p-1 hover:bg-zinc-700">
							<Play class="h-4 w-4 text-zinc-300" />
						</button>
					</Tooltip.Trigger>
					<Tooltip.Content>
						<p>Run Code (shift+enter)</p>
					</Tooltip.Content>
				</Tooltip.Root>

				<Tooltip.Root>
					<Tooltip.Trigger>
						<button
							onclick={() => (showConsole = !showConsole)}
							class={['rounded p-1 hover:bg-zinc-700', showConsole ? 'bg-zinc-700' : '']}
						>
							<Terminal class="h-4 w-4 text-zinc-300" />
						</button>
					</Tooltip.Trigger>
					<Tooltip.Content>
						<p>Toggle Console</p>
					</Tooltip.Content>
				</Tooltip.Root>

				<button onclick={() => (showEditor = false)} class="rounded p-1 hover:bg-zinc-700">
					<X class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
				<CodeEditor
					value={code}
					onchange={handleCodeChange}
					language="javascript"
					nodeType="dsp~"
					placeholder="Enter dsp code here..."
					class="nodrag h-64 w-full resize-none"
					onrun={runDSP}
					{lineErrors}
				/>
			</div>

			<div class="mt-3 w-full" class:hidden={!showConsole}>
				<VirtualConsole
					bind:this={consoleRef}
					{nodeId}
					placeholder="DSP errors will appear here."
					maxHeight="150px"
				/>
			</div>
		</div>
	{/if}
</div>
