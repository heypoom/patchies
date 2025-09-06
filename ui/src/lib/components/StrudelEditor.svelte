<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Prec, StateEffect } from '@codemirror/state';
	import { keymap, EditorView } from '@codemirror/view';
	import { AudioSystem } from '$lib/audio/AudioSystem';
	import type { MessageContext, SendMessageOptions } from '$lib/messages/MessageContext';

	let {
		code = '',
		sync = false,
		solo = true,
		class: className = '',
		onUpdateState = undefined,
		onchange = undefined,
		messageContext,
		nodeId,
		...props
	}: {
		code?: string;
		sync?: boolean;
		solo?: boolean;
		class?: string;
		onUpdateState?: (state: unknown) => void;
		onchange?: (code: string) => void;
		messageContext?: MessageContext;
		nodeId: string;
		[key: string]: unknown;
	} = $props();

	let containerElement: HTMLElement;
	let editor: any | null = null;
	let audioSystem = AudioSystem.getInstance();

	const hap2value = (hap: any) => {
		hap.ensureObjectValue();
		return hap.value;
	};

	onMount(async () => {
		audioSystem.createAudioObject(nodeId, 'gain~', [, 1]);

		// Load all required Strudel modules
		const [strudelCore, strudelDraw, strudelTranspiler, strudelWebaudio, strudelCodemirror] =
			await Promise.all([
				import('@strudel/core'),
				import('@strudel/draw'),
				import('@strudel/transpiler'),
				import('@strudel/webaudio'),
				import('@strudel/codemirror')
			]);

		const { silence, evalScope } = strudelCore;
		const { getDrawContext } = strudelDraw;
		const { transpiler } = strudelTranspiler;
		const { webaudioOutput } = strudelWebaudio;
		const { StrudelMirror, codemirrorSettings, settings: themeSettings } = strudelCodemirror;

		// Dynamically import and create prebake function
		const { prebake } = await import('$lib/strudel/prebake');

		for (const key in themeSettings) {
			themeSettings[key].background = 'transparent';
		}

		const settings = codemirrorSettings.get();
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

				const onMessage = messageContext?.createOnMessageFunction();

				evalScope({ send, onMessage, recv: onMessage });
			},
			afterEval: () => {
				let attempts = 0;

				let itv = setInterval(() => {
					// @ts-expect-error -- hack from patching strudel
					const g = window.SuperdoughDestinationGain as GainNode;
					const outGain = audioSystem.nodesById.get(nodeId)?.node;

					if (g && outGain) {
						clearInterval(itv);

						// destination gain might already be disconnected.
						try {
							g.disconnect(audioSystem.audioContext.destination);
						} catch {}

						g.connect(outGain);
					} else if (attempts > 500) {
						console.log('>> failed to hijack strudel output!');
						clearInterval(itv);
					} else {
						attempts++;
					}
				}, 5);
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
