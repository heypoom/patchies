<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { match, P } from 'ts-pattern';
	import { AudioSystem } from '$lib/audio/AudioSystem';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import SimpleDspLayout from './SimpleDspLayout.svelte';

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

	let audioSystem = AudioSystem.getInstance();

	const handleMessage: MessageCallbackFn = (message, meta) => {
		match(message)
			.with({ type: 'run' }, () => runElementary())
			.with(P.any, () => {
				if (meta?.inlet === undefined) return;

				audioSystem.send(nodeId, 'messageInlet', {
					inletIndex: meta.inlet,
					message,
					meta
				});
			});
	};

	const updateAudioCode = (code: string) => audioSystem.send(nodeId, 'code', code);

	function handleCodeChange(newCode: string) {
		updateNodeData(nodeId, { code: newCode });

		setTimeout(() => {
			const elemNode = audioSystem.nodesById.get(nodeId);

			if (!elemNode || elemNode.type !== 'elem~') return;

			if (elemNode?.elementaryManager) {
				elemNode.elementaryManager.onSetPortCount = (inletCount: number) => {
					updateNodeData(nodeId, { messageInletCount: inletCount });
				};
			}
		}, 10);
	}

	function runElementary() {
		updateAudioCode(data.code);
	}

	onMount(() => {
		audioSystem.createAudioObject(nodeId, 'elem~', [null, data.code]);
		handleCodeChange(data.code);
	});

	onDestroy(() => {
		audioSystem.removeAudioObject(nodeId);
	});
</script>

<SimpleDspLayout
	{nodeId}
	nodeName="elem~"
	{data}
	{selected}
	onCodeChange={handleCodeChange}
	onRun={runElementary}
	{handleMessage}
/>
