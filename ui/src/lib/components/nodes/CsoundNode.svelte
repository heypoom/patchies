<script lang="ts">
	import SimpleDspLayout from './SimpleDspLayout.svelte';
	import { useSvelteFlow, type NodeProps } from '@xyflow/svelte';
	import { AudioSystem } from '$lib/audio/AudioSystem';
	import { createCsoundMessageHandler } from '$lib/audio/nodes/CsoundManager';
	import { onDestroy, onMount } from 'svelte';

	let {
		id: nodeId,
		data,
		selected
	}: NodeProps & {
		data: {
			code: string;
		};
	} = $props();

	const audioSystem = AudioSystem.getInstance();
	const { updateNodeData } = useSvelteFlow();

	function handleCodeChange(newCode: string) {
		updateNodeData(nodeId, { code: newCode });
	}

	function handleRun() {
		const node = audioSystem.nodesById.get(nodeId);

		if (node?.type === 'csound~' && node.csoundManager) {
			node.csoundManager.handleMessage('code', data.code || '');
		}
	}

	function handleMessage(msg: unknown, meta: unknown) {
		const node = audioSystem.nodesById.get(nodeId);

		if (node?.type === 'csound~' && node.csoundManager) {
			const handler = createCsoundMessageHandler(node.csoundManager);

			handler(msg, meta);
		}
	}

	onMount(() => {
		audioSystem.createAudioObject(nodeId, 'csound~', [null, data.code]);
	});

	onDestroy(() => {
		audioSystem.removeAudioObject(nodeId);
	});
</script>

<SimpleDspLayout
	{nodeId}
	nodeName="csound~"
	{data}
	{selected}
	onCodeChange={handleCodeChange}
	onRun={handleRun}
	{handleMessage}
/>
