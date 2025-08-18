<script lang="ts">
	import { NodeResizer, useSvelteFlow } from '@xyflow/svelte';
	import { onMount } from 'svelte';
	import OverType from 'overtype';

	let props: {
		id: string;
		data: { markdown: string };
		selected: boolean;
		width: number;
		height: number;
	} = $props();

	const { id: nodeId, data, selected } = props;
	const [defaultWidth, defaultHeight] = [300, 150];

	let overtypeElement: HTMLDivElement;
	let overtypeEditor: any;

	const { updateNodeData } = useSvelteFlow();

	function handleMarkdownChange(markdown: string) {
		updateNodeData(nodeId, { ...data, markdown });
	}

	const borderColor = $derived(selected ? 'border-zinc-400' : 'border-zinc-700');

	onMount(() => {
		const [_editor] = new OverType(overtypeElement, {
			placeholder: 'Start typing markdown...',
			toolbar: false,
			value: data.markdown,
			theme: {
				name: 'my-theme',
				colors: {
					bgPrimary: '#18181B',
					bgSecondary: '#18181B',
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
			onChange: (value, instance) => {
				handleMarkdownChange(value);
			}
		});

		overtypeEditor = _editor;
	});
</script>

<div class="relative">
	<NodeResizer class="z-1" isVisible={props.selected} />

	<div class="absolute -top-8 z-10 w-fit rounded-lg bg-zinc-900/60 px-2 py-1 backdrop-blur-lg">
		<div class="font-mono text-xs font-medium text-zinc-400">markdown</div>
	</div>

	<div
		bind:this={overtypeElement}
		style="width: {props.width ?? defaultWidth}px; height: {props.height ?? defaultHeight}px"
		class="nodrag"
	></div>
</div>
