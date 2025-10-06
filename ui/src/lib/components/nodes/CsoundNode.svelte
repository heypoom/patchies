<script lang="ts">
	import SimpleDspLayout from './SimpleDspLayout.svelte';
	import { useSvelteFlow, type NodeProps } from '@xyflow/svelte';
	import { AudioSystem } from '$lib/audio/AudioSystem';
	import { createCsoundMessageHandler } from '$lib/audio/nodes/CsoundManager';

	let { id, data, selected }: NodeProps = $props();

	const audioSystem = AudioSystem.getInstance();
	const { updateNodeData } = useSvelteFlow();

	function handleCodeChange(newCode: string) {
		updateNodeData(id, { code: newCode });
	}

	function handleRun() {
		const node = audioSystem.nodesById.get(id);

		if (node?.type === 'csound~' && node.csoundManager) {
			node.csoundManager.handleMessage('code', data.code || '');
		}
	}

	function handleMessage(msg: unknown, meta: unknown) {
		const node = audioSystem.nodesById.get(id);

		if (node?.type === 'csound~' && node.csoundManager) {
			const handler = createCsoundMessageHandler(node.csoundManager);

			handler(msg, meta);
		}
	}
</script>

<SimpleDspLayout
	nodeId={id}
	nodeName="csound~"
	{data}
	{selected}
	onCodeChange={handleCodeChange}
	onRun={handleRun}
	{handleMessage}
/>
