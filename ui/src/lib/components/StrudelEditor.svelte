<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { silence, evalScope } from '@strudel/core';
	import { getDrawContext } from '@strudel/draw';
	import { transpiler } from '@strudel/transpiler';
	import { webaudioOutput } from '@strudel/webaudio';
	import {
		StrudelMirror,
		codemirrorSettings,
		settings as themeSettings
	} from '@strudel/codemirror';
	import { superdough } from 'superdough';
	import { prebake } from '$lib/strudel/prebake';
	import { Prec, StateEffect } from '@codemirror/state';
	import { keymap, EditorView } from '@codemirror/view';
	import { AudioSystem } from '$lib/audio/AudioSystem';
	import type { MessageContext, SendMessageOptions } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';

	let {
		code = '',
		sync = false,
		solo = true,
		class: className = '',
		onUpdateState = undefined,
		onchange = undefined,
		messageContext,
		...props
	}: {
		code?: string;
		sync?: boolean;
		solo?: boolean;
		class?: string;
		onUpdateState?: (state: unknown) => void;
		onchange?: (code: string) => void;
		messageContext?: MessageContext;
		[key: string]: unknown;
	} = $props();

	let containerElement: HTMLElement;
	let editor: StrudelMirror | null = null;
	let audioSystem = AudioSystem.getInstance();

	for (const key in themeSettings) {
		themeSettings[key].background = 'transparent';
	}

	let settings = codemirrorSettings.get();

	const hap2value = (hap) => {
		hap.ensureObjectValue();
		return hap.value;
	};

	onMount(() => {
		const drawContext = getDrawContext();
		const drawTime = [-2, 2];

		editor = new StrudelMirror({
			defaultOutput: webaudioOutput,
			getTime: () => audioSystem.audioContext.currentTime,
			transpiler,
			root: containerElement,
			initialCode: '// loading...',
			pattern: silence,
			drawTime,
			drawContext,
			async prebake() {
				await prebake();
			},
			onUpdateState,
			solo,
			sync,
			beforeEval: () => {
				const send = (data: unknown, options: SendMessageOptions) => {
					messageContext?.send(data, options);
				};

				evalScope({ send, onMessage: messageContext?.createOnMessageFunction() });
			}
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

		const onchangeExtension = onchange
			? EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						const newCode = editor.editor.state.doc.toString();

						if (newCode !== code) {
							onchange(newCode);
						}
					}
				})
			: [];

		editor.editor.dispatch({
			effects: StateEffect.appendConfig.of([keymaps, onchangeExtension].filter(Boolean))
		});
	});

	onDestroy(() => {
		editor?.stop();
	});

	export { editor };
</script>

<div bind:this={containerElement} class={className} {...props}></div>
