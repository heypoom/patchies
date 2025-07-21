<script lang="ts">
	import { Position } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import StrudelEditor from '$lib/components/StrudelEditor.svelte';
	import { AudioSystem } from '$lib/audio/AudioSystem';
	import { getAudioContext } from '@strudel/webaudio';
	import VideoHandle from '$lib/components/VideoHandle.svelte';

	// Get node data from XY Flow - nodes receive their data as props
	let { id: nodeId }: { id: string } = $props();

	let strudelEditor: StrudelEditor | null = null;
	let audioSystem: AudioSystem;
	let errorMessage = $state<string | null>(null);
	let isPlaying = $state(false);
	let isInitialized = $state(false);
	let code = $state(`note("c a f e").jux(rev)`);

	onMount(() => {
		audioSystem = AudioSystem.getInstance();

		// Set up Strudel audio context for the audio system
		const audioContext = getAudioContext();
		audioSystem.setStrudelAudioContext(audioContext);

		// Wait for the StrudelEditor to be ready
		setTimeout(() => {
			if (strudelEditor?.editor) {
				isInitialized = true;

				// Register this node as an audio source for analysis
				// The AudioSystem's global audio tap will capture Strudel's audio output
				if (audioContext.destination) {
					audioSystem.registerAudioSource(nodeId, audioContext.destination);
				}

				// @ts-expect-error -- for debugging
				window.strudel = strudelEditor.editor;
			}
		}, 1000);
	});

	onDestroy(() => {
		if (strudelEditor?.editor) {
			strudelEditor.editor.stop();
		}
		if (audioSystem) {
			audioSystem.unregisterNode(nodeId);
		}
	});

	function stop() {
		if (strudelEditor?.editor) {
			try {
				strudelEditor.editor.stop();
				isPlaying = false;
				errorMessage = null;
			} catch (error) {
				errorMessage = error instanceof Error ? error.message : String(error);
			}
		}
	}

	function play() {
		if (strudelEditor?.editor) {
			try {
				strudelEditor.editor.evaluate();
				errorMessage = null;
			} catch (error) {
				errorMessage = error instanceof Error ? error.message : String(error);
				isPlaying = false;
			}
		}
	}

	function handleUpdateState(state: { started: boolean }) {
		isPlaying = state.started;
	}
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
					<div class="font-mono text-xs font-medium text-zinc-100">strudel</div>
				</div>

				<div class="flex items-center gap-1">
					<!-- Play/Stop button -->
					{#if isInitialized}
						{#if isPlaying}
							<button
								class="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700"
								onclick={stop}
								title="Stop"
							>
								<Icon icon="lucide:square" class="h-4 w-4 text-zinc-300" />
							</button>
						{:else}
							<button
								class="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700"
								onclick={play}
								title="Play"
							>
								<Icon icon="lucide:play" class="h-4 w-4 text-zinc-300" />
							</button>
						{/if}
					{/if}
				</div>
			</div>

			<div class="relative">
				<div class="flex w-full items-center justify-center rounded-md bg-zinc-900">
					<div class="nodrag">
						<StrudelEditor
							{code}
							bind:this={strudelEditor}
							onUpdateState={handleUpdateState}
							class="w-full"
						/>
					</div>
				</div>

				<!-- Error display -->
				{#if errorMessage}
					<div
						class="absolute inset-0 flex items-center justify-center rounded-md bg-red-900/90 p-2"
					>
						<div class="text-center">
							<div class="text-xs font-medium text-red-100">Strudel Error:</div>
							<div class="mt-1 text-xs text-red-200">{errorMessage}</div>
						</div>
					</div>
				{/if}

				<VideoHandle
					type="source"
					position={Position.Bottom}
					id="audio-out"
					class="!left-1/2 !-translate-x-1/2 !transform"
					title="Audio Output"
				/>
			</div>
		</div>
	</div>
</div>
