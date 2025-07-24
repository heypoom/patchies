<script lang="ts">
	import { Position } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import { VideoSystem } from '$lib/video/VideoSystem';
	import { EditorView } from 'codemirror';

	// Get node data from XY Flow - nodes receive their data as props
	let { id: nodeId }: { id: string } = $props();

	let canvasElement: HTMLCanvasElement;
	let videoElement: HTMLVideoElement;
	let videoSystem: VideoSystem;
	let showEditor = $state(false);
	let errorMessage = $state<string | null>(null);
	let isLoading = $state(false);
	let hasVideo = $state(false);
	let abortController: AbortController | null = null;

	let prompt = $state(
		`a sleepy little town in the mountains, masterpiece, realistic, high quality, 4k`
	);

	onMount(() => {
		videoSystem = VideoSystem.getInstance();
		videoSystem.registerVideoSource(nodeId, canvasElement);
	});

	onDestroy(() => {
		videoSystem?.unregisterNode(nodeId);
	});

	async function updatePrompt() {
		if (isLoading) {
			if (abortController) {
				abortController.abort();
			}

			isLoading = false;

			return;
		}

		hasVideo = false;
		isLoading = true;
		errorMessage = null;

		try {
			// TODO: add video generation

			hasVideo = true;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
			hasVideo = false;
		} finally {
			isLoading = false;
		}
	}

	function toggleEditor() {
		showEditor = !showEditor;
	}
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
					<div class="font-mono text-xs font-medium text-zinc-100">ai.vdo</div>
				</div>

				<button
					class="rounded p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
					onclick={toggleEditor}
					title="Edit code"
				>
					<Icon icon="lucide:code" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="relative">
				<div class="relative">
					{#if !hasVideo || isLoading}
						<div class="pointer-events-none absolute h-full w-full">
							<div class="flex h-full items-center justify-center">
								<Icon
									icon={isLoading ? 'lucide:loader' : 'lucide:video'}
									class={`h-8 w-8 text-zinc-300 ${isLoading ? 'animate-spin' : ''}`}
								/>
							</div>
						</div>
					{/if}

					<div>
						<canvas
							bind:this={canvasElement}
							width={800}
							height={800}
							class="h-[200px] w-[200px] rounded-md bg-zinc-900"
						></canvas>

						<video bind:this={videoElement} playsinline autoplay muted loop></video>
					</div>
				</div>

				<VideoHandle type="source" position={Position.Bottom} id="video-out" title="Video output" />
			</div>
		</div>
	</div>

	{#if showEditor}
		<div class="relative max-w-[350px]">
			<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
				<button onclick={updatePrompt} class="rounded p-1 hover:bg-zinc-700">
					<Icon icon={isLoading ? 'lucide:square' : 'lucide:play'} class="h-4 w-4 text-zinc-300" />
				</button>

				<button onclick={() => (showEditor = false)} class="rounded p-1 hover:bg-zinc-700">
					<Icon icon="lucide:x" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
				<CodeEditor
					bind:value={prompt}
					language="text"
					placeholder="Write your prompt here..."
					class="nodrag h-64 w-full max-w-[350px] resize-none"
					onrun={updatePrompt}
					extraExtensions={[EditorView.lineWrapping]}
				/>
			</div>

			{#if errorMessage}
				<div class="mt-2 px-2 py-1 font-mono text-xs text-red-300">
					{errorMessage}
				</div>
			{/if}
		</div>
	{/if}
</div>
