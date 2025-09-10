<script lang="ts">
	import { NodeResizer, useSvelteFlow } from '@xyflow/svelte';
	import { onDestroy, onMount } from 'svelte';
	import OverType from 'overtype';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';

	let props: {
		id: string;
		data: {
			markdown: string;
		};
		selected: boolean;
		width: number;
		height: number;
	} = $props();

	let messageContext: MessageContext;

	const [defaultWidth, defaultHeight] = [300, 150];

	let overtypeElement: HTMLDivElement;
	let overtypeEditor: any;

	const { updateNodeData } = useSvelteFlow();

	const handleClass = $derived(
		props.selected
			? 'z-1 transition-opacity'
			: 'z-1 sm:opacity-0 opacity-30 group-hover:opacity-100 transition-opacity'
	);

	function handleMarkdownChange(markdown: string) {
		updateNodeData(props.id, { markdown });
	}

	function updateMarkdown(markdown: string) {
		handleMarkdownChange(markdown);
		overtypeEditor?.setValue(markdown);
	}

	const handleMessage: MessageCallbackFn = (message) =>
		match(message)
			.with(P.string, (value) => updateMarkdown(value))
			.with({ type: 'bang' }, () => messageContext.send(props.data.markdown))
			.with({ type: 'set', value: P.string }, (msg) => updateMarkdown(msg.value))
			.otherwise(() => {});

	onDestroy(() => {
		messageContext.queue.removeCallback(handleMessage);
		messageContext.destroy();
	});

	onMount(async () => {
		messageContext = new MessageContext(props.id);
		messageContext.queue.addCallback(handleMessage);

		const [_editor] = new OverType(overtypeElement, {
			placeholder: 'Start typing markdown...',
			toolbar: false,
			value: props.data.markdown,
			theme: {
				name: 'my-theme',
				colors: {
					bgPrimary: 'transparent',
					bgSecondary: 'transparent',
					text: '#fff',
					h1: '#fff',
					h2: '#fff',
					h3: '#fff',
					strong: '#fff',
					em: '#fff',
					link: '#fff',
					code: '#fff',
					codeBg: 'rgba(255, 255, 255, 0.2)',
					blockquote: '#fff',
					hr: '#fff',
					syntaxMarker: 'rgba(255, 255, 255, 0.52)',
					cursor: '#f95738',
					selection: 'rgba(244, 211, 94, 0.4)'
				}
			},
			onChange: (value: string) => handleMarkdownChange(value)
		});

		overtypeEditor = _editor;
	});
</script>

<div class="relative">
	<NodeResizer class="z-1" isVisible={props.selected} />

	{#if props.selected}
		<div class="absolute -top-7 z-10 w-fit rounded-lg bg-zinc-900/60 px-2 py-1 backdrop-blur-lg">
			<div class="font-mono text-xs font-medium text-zinc-400">markdown</div>
		</div>
	{/if}

	<div class="group">
		<StandardHandle port="inlet" type="message" total={1} index={0} class={handleClass} />

		<div
			bind:this={overtypeElement}
			style="width: {props.width ?? defaultWidth}px; height: {props.height ?? defaultHeight}px"
			class="nodrag overtype-editor rounded-lg bg-zinc-900/70 backdrop-blur-xl"
		></div>

		<StandardHandle port="outlet" type="message" total={1} index={0} class={handleClass} />
	</div>
</div>

<style scoped>
	@reference "../../../app.css";

	.overtype-editor :global(.overtype-wrapper) {
		@apply rounded-lg;
	}
</style>
