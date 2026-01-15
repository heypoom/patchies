<script lang="ts">
	import type { Snippet } from 'svelte';
	import ObjectPreviewLayout from './ObjectPreviewLayout.svelte';

	let {
		title,
		nodeId,
		selected = false,
		hasError = false,
		onrun,
		onPlaybackToggle,
		paused = false,
		showPauseButton = false,
		showConsoleButton = false,
		previewCanvas = $bindable<HTMLCanvasElement>(),
		nodrag = false,
		tabindex,

		width,
		height,
		style = '',

		topHandle,
		bottomHandle,

		codeEditor,
		console: consoleSnippet,
		editorReady
	}: {
		title: string;
		nodeId?: string;
		selected?: boolean;
		hasError?: boolean;
		onrun?: () => void;
		onPlaybackToggle?: () => void;
		paused?: boolean;
		showPauseButton?: boolean;
		showConsoleButton?: boolean;
		previewCanvas?: HTMLCanvasElement;
		nodrag?: boolean;
		tabindex?: number;

		width?: string | number;
		height?: string | number;
		style?: string;

		topHandle?: Snippet;
		bottomHandle?: Snippet;

		codeEditor: Snippet;
		console?: Snippet;
		editorReady?: boolean;
	} = $props();
</script>

<ObjectPreviewLayout
	{title}
	{nodeId}
	{onrun}
	{onPlaybackToggle}
	{paused}
	{showPauseButton}
	{showConsoleButton}
	{topHandle}
	{bottomHandle}
	{codeEditor}
	{editorReady}
	console={consoleSnippet}
>
	{#snippet preview()}
		<canvas
			bind:this={previewCanvas}
			class={[
				'rounded-md border',
				hasError
					? 'border-red-500/70'
					: selected
						? 'shadow-glow-md border-zinc-400 [&>canvas]:rounded-[7px]'
						: 'hover:shadow-glow-sm border-transparent [&>canvas]:rounded-md',
				nodrag ? 'nodrag cursor-default' : 'cursor-grab'
			]}
			{tabindex}
			width={typeof width === 'number' ? width : undefined}
			height={typeof height === 'number' ? height : undefined}
			{style}
		></canvas>
	{/snippet}
</ObjectPreviewLayout>
