<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { match, P } from 'ts-pattern';
	import { AudioService } from '$lib/audio/v2/AudioService';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import SimpleDspLayout from './SimpleDspLayout.svelte';
	import type { ToneNode } from '$lib/audio/v2/nodes/ToneNode';

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
			title?: string;
			executeCode?: number;
		};
		selected: boolean;
	} = $props();

	// Get flow utilities to update node data
	const { updateNodeData } = useSvelteFlow();

	let audioService = AudioService.getInstance();
	let previousExecuteCode = $state<number | undefined>(undefined);
	
	// Watch for executeCode timestamp changes and re-run when it changes
	$effect(() => {
		if (data.executeCode && data.executeCode !== previousExecuteCode) {
			previousExecuteCode = data.executeCode;
			runTone();
		}
	});

	const handleMessage: MessageCallbackFn = (message, meta) => {
		match(message)
			.with({ type: 'run' }, () => runTone())
			.with(P.any, () => {
				if (meta?.inlet === undefined) return;

				audioService.send(nodeId, 'messageInlet', {
					inletIndex: meta.inlet,
					message,
					meta
				});
			});
	};

	const updateAudioCode = (code: string) => audioService.send(nodeId, 'code', code);

	function handleCodeChange(newCode: string) {
		updateNodeData(nodeId, { code: newCode });

		setTimeout(() => {
			const toneNode = audioService.getNodeById(nodeId) as ToneNode | undefined;

			if (!toneNode) return;

			toneNode.onSetPortCount = (inletCount: number, outletCount: number) => {
				updateNodeData(nodeId, {
					messageInletCount: inletCount,
					messageOutletCount: outletCount
				});
			};

			toneNode.onSetTitle = (title: string) => {
				updateNodeData(nodeId, { title });
			};
		}, 10);
	}

	function runTone() {
		updateAudioCode(data.code);
	}

	onMount(() => {
		audioService.createNode(nodeId, 'tone~', [null, data.code]);
		handleCodeChange(data.code);
	});

	onDestroy(() => {
		const node = audioService.getNodeById(nodeId);

		if (node) {
			audioService.removeNode(node);
		}
	});
</script>

<SimpleDspLayout
	{nodeId}
	nodeName="tone~"
	nodeType="tone~"
	{data}
	{selected}
	onCodeChange={handleCodeChange}
	onRun={runTone}
	{handleMessage}
/>
