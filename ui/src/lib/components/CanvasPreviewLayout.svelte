<script lang="ts">
	import type { Snippet } from 'svelte';
	import ObjectPreviewLayout from './ObjectPreviewLayout.svelte';

	let {
		title,
		selected = false,
		onrun,
		onPlaybackToggle,
		paused = false,
		showPauseButton = false,
		previewCanvas = $bindable<HTMLCanvasElement>(),
		nodrag = false,

		width,
		height,

		topHandle,
		bottomHandle,
		codeEditor
	}: {
		title: string;
		selected?: boolean;
		onrun?: () => void;
		onPlaybackToggle?: () => void;
		paused?: boolean;
		showPauseButton?: boolean;
		previewCanvas?: HTMLCanvasElement;
		errorMessage?: string | null;
		nodrag?: boolean;

		width?: string | number;
		height?: string | number;

		topHandle: Snippet;
		bottomHandle: Snippet;
		codeEditor: Snippet;
	} = $props();
</script>

<ObjectPreviewLayout
	{title}
	{onrun}
	{onPlaybackToggle}
	{paused}
	{showPauseButton}
	{topHandle}
	{bottomHandle}
	{codeEditor}
>
	{#snippet preview()}
		<canvas
			bind:this={previewCanvas}
			class={[
				'rounded-md border bg-zinc-900',
				selected
					? 'border-zinc-200 [&>canvas]:rounded-[7px]'
					: 'border-transparent [&>canvas]:rounded-md',
				nodrag ? 'nodrag cursor-default' : 'cursor-grab'
			]}
			{width}
			{height}
		></canvas>
	{/snippet}
</ObjectPreviewLayout>
