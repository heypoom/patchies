<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { AudioSystem } from '$lib/audio/AudioSystem';
	import CommonExprLayout from './CommonExprLayout.svelte';
	import Icon from '@iconify/svelte';

	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: { expr: string };
		selected: boolean;
	} = $props();

	let isEditing = $state(!data.expr);
	let layoutRef = $state<any>();
	let isPlaying = $state(true);

	let messageContext: MessageContext;
	let audioSystem = AudioSystem.getInstance();

	const { updateNodeData } = useSvelteFlow();

	const getManager = () => {
		const node = audioSystem.nodesById.get(nodeId);

		if (node?.type === 'csound~' && node.csoundManager) {
			return node.csoundManager;
		}
	};

	const handleMessage: MessageCallbackFn = (message, meta) => {
		const manager = getManager();
		if (!manager) return;

		manager.handleMessage('messageInlet', { inletIndex: meta.inlet, message, meta });
	};

	const runCsoundCode = (code: string) => {
		const manager = getManager();
		if (!manager) return;

		manager.handleMessage('code', code);
	};

	const handleExpressionChange = (newExpr: string) => updateNodeData(nodeId, { expr: newExpr });

	const handleRun = () => runCsoundCode(data.expr);

	async function handlePlayPause() {
		const manager = getManager();
		if (!manager) return;

		const isPaused = manager.getIsPaused();

		if (isPaused) {
			await manager.resume();
		} else {
			await manager.pause();
		}

		isPlaying = !isPlaying;
	}

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);

		audioSystem.createAudioObject(nodeId, 'csound~', [null, data.expr]);

		if (isEditing) {
			setTimeout(() => layoutRef?.focus(), 10);
		}
	});

	onDestroy(() => {
		messageContext.queue.removeCallback(handleMessage);
		messageContext.destroy();
		audioSystem.removeAudioObject(nodeId);
	});
</script>

{#snippet csoundInlets()}
	<StandardHandle port="inlet" type="audio" title="Audio Input" total={2} index={0} />

	<StandardHandle port="inlet" type="message" title="Message Input" id={0} total={2} index={1} />
{/snippet}

{#snippet csoundOutlets()}
	<StandardHandle port="outlet" type="audio" title="Audio Output" total={1} index={0} />
{/snippet}

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<!-- Floating toolbar -->
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div></div>

				<div class="flex gap-1 transition-opacity group-hover:opacity-100 sm:opacity-0">
					<!-- Play/Pause button -->
					<button
						onclick={handlePlayPause}
						class="rounded p-1 hover:bg-zinc-700"
						title={isPlaying ? 'Pause' : 'Play'}
					>
						<Icon icon={isPlaying ? 'lucide:pause' : 'lucide:play'} class="h-4 w-4" />
					</button>
				</div>
			</div>

			<div class="csound-node-container relative">
				<CommonExprLayout
					bind:this={layoutRef}
					{nodeId}
					{data}
					{selected}
					expr={data.expr}
					bind:isEditing
					placeholder="instr 1\n  a1 oscil 0.5, 440\n  out a1\nendin\nschedule(1, 0, 1)"
					editorClass="csound-node-code-editor"
					onExpressionChange={handleExpressionChange}
					exitOnRun={false}
					onRun={handleRun}
					handles={csoundInlets}
					outlets={csoundOutlets}
				/>
			</div>
		</div>
	</div>
</div>

<style>
	:global(.csound-node-code-editor .cm-content) {
		padding: 6px 8px 7px 4px !important;
	}

	:global(.csound-node-container .expr-preview) {
		overflow-x: hidden;
	}

	:global(.csound-node-container .expr-display),
	:global(.csound-node-container .expr-editor-container) {
		max-width: 600px !important;
	}
</style>
