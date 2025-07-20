<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { silence } from '@strudel/core';
	import { getDrawContext } from '@strudel/draw';
	import { transpiler } from '@strudel/transpiler';
	import { getAudioContext, webaudioOutput } from '@strudel/webaudio';
	import { StrudelMirror, codemirrorSettings } from '@strudel/codemirror';
	import { prebake } from '$lib/strudel/prebake';

	let {
		code = '',
		sync = false,
		solo = true,
		class: className = '',
		onUpdateState = undefined,
		...props
	}: {
		code?: string;
		sync?: boolean;
		solo?: boolean;
		class?: string;
		onUpdateState?: (state: unknown) => void;
		[key: string]: unknown;
	} = $props();

	let containerElement: HTMLElement;
	let editor: StrudelMirror | null = null;
	let settings = codemirrorSettings.get();

	onMount(() => {
		const drawContext = getDrawContext();
		const drawTime = [-2, 2];

		editor = new StrudelMirror({
			defaultOutput: webaudioOutput,
			getTime: () => getAudioContext().currentTime,
			transpiler,
			root: containerElement,
			initialCode: '// loading...',
			pattern: silence,
			drawTime,
			drawContext,
			prebake,
			onUpdateState,
			solo,
			sync
		});

		editor.updateSettings(settings);
		editor.setCode(code);
	});

	onDestroy(() => {
		editor?.stop();
	});

	$effect(() => {
		editor?.setCode(code);
	});

	export { editor };
</script>

<div bind:this={containerElement} class={className} {...props}></div>
