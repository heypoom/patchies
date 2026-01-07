<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { match, P } from 'ts-pattern';
	import { AudioService } from '$lib/audio/v2/AudioService';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import SimpleDspLayout from './SimpleDspLayout.svelte';
	import type { SonicNode } from '$lib/audio/v2/nodes/SonicNode';

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
		};
		selected: boolean;
	} = $props();

	// Get flow utilities to update node data
	const { updateNodeData } = useSvelteFlow();

	let audioService = AudioService.getInstance();

	const handleMessage: MessageCallbackFn = (message, meta) => {
		match(message)
			.with({ type: 'run' }, () => runSonic())
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
			const sonicNode = audioService.getNodeById(nodeId) as SonicNode | undefined;

			if (!sonicNode) return;

			sonicNode.onSetPortCount = (inletCount: number, outletCount: number) => {
				updateNodeData(nodeId, {
					messageInletCount: inletCount,
					messageOutletCount: outletCount
				});
			};
		}, 10);
	}

	function runSonic() {
		updateAudioCode(data.code);
	}

	onMount(() => {
		audioService.createNode(nodeId, 'sonic~', [null, data.code]);
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
	nodeName="sonic~"
	{data}
	{selected}
	onCodeChange={handleCodeChange}
	onRun={runSonic}
	{handleMessage}
/>
