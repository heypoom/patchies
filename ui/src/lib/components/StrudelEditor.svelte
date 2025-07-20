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
		if (typeof window === 'undefined') return;

		// setTimeout makes sure the dom is ready
		setTimeout(() => {
			const drawContext = getDrawContext();
			const drawTime = [-2, 2];

			editor = new StrudelMirror({
				defaultOutput: webaudioOutput,
				getTime: () => getAudioContext().currentTime,
				transpiler,
				root: containerElement,
				initialCode: '// LOADING',
				pattern: silence,
				drawTime,
				drawContext,
				prebake,
				onUpdateState: (state) => {
					if (onUpdateState) {
						onUpdateState(state);
					}
				},
				solo,
				sync
			});

			// init settings
			editor.updateSettings(settings);
			if (code) {
				editor.setCode(code);
			}
		});
	});

	onDestroy(() => {
		if (editor) {
			editor.stop();
		}
	});

	// Watch for code changes
	$effect(() => {
		if (editor && code !== undefined) {
			editor.setCode(code);
		}
	});

	// Expose editor methods
	export function evaluate() {
		return editor?.evaluate();
	}

	export function stop() {
		return editor?.stop();
	}

	export function setCode(newCode: string) {
		return editor?.setCode(newCode);
	}

	export function updateSettings(newSettings: unknown) {
		return editor?.updateSettings(newSettings);
	}

	export function getEditor() {
		return editor;
	}
</script>

<div bind:this={containerElement} class={className} {...props}></div>
