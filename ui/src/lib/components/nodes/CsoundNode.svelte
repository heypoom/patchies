<script lang="ts">
	import SimpleDspLayout from './SimpleDspLayout.svelte';
	import { useSvelteFlow, type NodeProps } from '@xyflow/svelte';
	import { AudioSystem } from '$lib/audio/AudioSystem';
	import { createCsoundMessageHandler } from '$lib/audio/nodes/CsoundManager';
	import { onDestroy, onMount } from 'svelte';
	import Icon from '@iconify/svelte';

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

	let isPlaying = $state(true);

	function handleCodeChange(newCode: string) {
		updateNodeData(nodeId, { code: newCode });
	}

	function handleRun() {
		const node = audioSystem.nodesById.get(nodeId);

		if (node?.type === 'csound~' && node.csoundManager) {
			node.csoundManager.handleMessage('code', data.code || '');
		}
	}

	async function handlePlayPause() {
		const node = audioSystem.nodesById.get(nodeId);

		if (node?.type === 'csound~' && node.csoundManager) {
			const manager = node.csoundManager;
			const isPaused = manager.getIsPaused();

			if (isPaused) {
				await manager.resume();
			} else {
				await manager.pause();
			}

			isPlaying = !isPlaying;
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
>
	{#snippet actionButtons()}
		<button
			class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
			onclick={(e) => {
				e.preventDefault();
				e.stopPropagation();

				handlePlayPause();
			}}
			title={isPlaying ? 'Pause' : 'Play'}
		>
			<Icon icon={isPlaying ? 'lucide:pause' : 'lucide:play'} class="h-4 w-4 text-zinc-300" />
		</button>
	{/snippet}
</SimpleDspLayout>
