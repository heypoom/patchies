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
		style = '',

		topHandle,
		bottomHandle,

		codeEditor,
		editorReady
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
		style?: string;

		topHandle?: Snippet;
		bottomHandle?: Snippet;

		codeEditor: Snippet;
		editorReady?: boolean;
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
	{editorReady}
>
	{#snippet preview()}
		<canvas
			bind:this={previewCanvas}
			class={[
				'rounded-md border',
				selected
					? 'border-zinc-200 [&>canvas]:rounded-[7px]'
					: 'border-transparent [&>canvas]:rounded-md',
				nodrag ? 'nodrag cursor-default' : 'cursor-grab'
			]}
			{width}
			{height}
			{style}
		></canvas>
	{/snippet}
</ObjectPreviewLayout>
