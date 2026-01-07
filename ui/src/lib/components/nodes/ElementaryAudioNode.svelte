<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { match, P } from 'ts-pattern';
	import { AudioService } from '$lib/audio/v2/AudioService';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import SimpleDspLayout from './SimpleDspLayout.svelte';
	import type { ElementaryNode } from '$lib/audio/v2/nodes/ElementaryNode';

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
		};
		selected: boolean;
	} = $props();

	// Get flow utilities to update node data
	const { updateNodeData } = useSvelteFlow();

	let audioService = AudioService.getInstance();

	const handleMessage: MessageCallbackFn = (message, meta) => {
		match(message)
			.with({ type: 'run' }, () => runElementary())
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
			const elemNode = audioService.getNodeById(nodeId) as ElementaryNode | undefined;

			if (!elemNode) return;

			elemNode.onSetPortCount = (inletCount: number, outletCount: number) =>
				updateNodeData(nodeId, {
					messageInletCount: inletCount,
					messageOutletCount: outletCount
				});

			elemNode.onSetTitle = (title: string) => {
				updateNodeData(nodeId, { title });
			};
		}, 10);
	}

	function runElementary() {
		updateAudioCode(data.code);
	}

	onMount(() => {
		audioService.createNode(nodeId, 'elem~', [null, data.code]);
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
	nodeName="elem~"
	nodeType="elem~"
	{data}
	{selected}
	onCodeChange={handleCodeChange}
	onRun={runElementary}
	{handleMessage}
/>
