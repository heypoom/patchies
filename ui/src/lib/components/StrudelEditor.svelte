<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { silence } from '@strudel/core';
	import { getDrawContext } from '@strudel/draw';
	import { transpiler } from '@strudel/transpiler';
	import { getAudioContext, webaudioOutput } from '@strudel/webaudio';
	import {
		StrudelMirror,
		codemirrorSettings,
		settings as themeSettings
	} from '@strudel/codemirror';
	import { superdough } from 'superdough';
	import { prebake } from '$lib/strudel/prebake';
	import { Prec, StateEffect } from '@codemirror/state';
	import { keymap } from '@codemirror/view';

	let {
		code = '',
		sync = false,
		solo = true,
		class: className = '',
		onUpdateState = undefined,
		onAudioNodes = undefined,
		...props
	}: {
		code?: string;
		sync?: boolean;
		solo?: boolean;
		class?: string;
		onUpdateState?: (state: unknown) => void;
		onAudioNodes?: (audioNodes: AudioNode[]) => void;
		[key: string]: unknown;
	} = $props();

	let containerElement: HTMLElement;
	let editor: StrudelMirror | null = null;

	for (const key in themeSettings) {
		themeSettings[key].background = 'transparent';
	}

	let settings = codemirrorSettings.get();
	let audioNodes: AudioNode[] = [];
	let audioNodeReady = $state(false);

	onMount(() => {
		const drawContext = getDrawContext();
		const drawTime = [-2, 2];

		editor = new StrudelMirror({
			defaultOutput(...args) {
				return webaudioOutput(...args).then((_audioNodes) => {
					if (onAudioNodes) {
						audioNodes = _audioNodes;
						audioNodeReady = true;
						onAudioNodes(audioNodes);
					}

					return audioNodes;
				});
			},
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
		editor.setTheme('strudelTheme');
		editor.setFontFamily('Menlo, monospace');
		editor.setFontSize(15);

		const keymaps = Prec.highest(
			keymap.of([
				{
					key: 'Shift-Enter',
					run: () => {
						editor.evaluate();
						return true;
					}
				}
			])
		);

		editor.editor.dispatch({
			effects: StateEffect.appendConfig.of([keymaps])
		});
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
