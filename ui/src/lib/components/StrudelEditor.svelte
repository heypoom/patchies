<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Prec, StateEffect } from '@codemirror/state';
	import { keymap, EditorView } from '@codemirror/view';
	import { AudioService } from '$lib/audio/v2/AudioService';
	import type { MessageContext, SendMessageOptions } from '$lib/messages/MessageContext';
	import { logger } from '$lib/utils/logger';
	import type { CustomConsole } from '$lib/utils/createCustomConsole';

	import {
		STRUDEL_EDITOR_DEFAULT_FONT_FAMILY,
		STRUDEL_EDITOR_DEFAULT_FONT_SIZE
	} from '$lib/strudel/editor-defaults';

	let {
		code = '',
		sync = false,
		solo = true,
		class: className = '',
		fontFamily = STRUDEL_EDITOR_DEFAULT_FONT_FAMILY,
		fontSize = STRUDEL_EDITOR_DEFAULT_FONT_SIZE,
		onUpdateState = undefined,
		onchange = undefined,
		onBeforeEvaluate = undefined,
		messageContext,
		nodeId,
		customConsole,
		...props
	}: {
		code?: string;
		sync?: boolean;
		solo?: boolean;
		class?: string;
		fontFamily?: string;
		fontSize?: number;
		onUpdateState?: (state: unknown) => void;
		onchange?: (code: string) => void;
		onBeforeEvaluate?: () => void;
		messageContext?: MessageContext;
		nodeId: string;
		customConsole?: CustomConsole;
		[key: string]: unknown;
	} = $props();

	let containerElement: HTMLElement;
	let editor: any | null = null;
	let audioService = AudioService.getInstance();

	const hap2value = (hap: any) => {
		hap.ensureObjectValue();
		return hap.value;
	};

	onMount(async () => {
		audioService.createNode(nodeId, 'gain~', [, 1]);

		const superdough = // @ts-expect-error -- no typedef
			await import('superdough');

		const logToConsole = (msg: string) => {
			if (customConsole) {
				customConsole.log(msg);
			} else {
				logger.nodeLog(nodeId, msg);
			}
		};

		superdough.setLogger(logToConsole);

		// Tell superdough to use our AudioContext instead of creating its own
		const context = audioService.getAudioContext();

		if ('setAudioContext' in superdough) {
			logToConsole('[audio] ready');
			superdough.setAudioContext(context);
		}

		// Load all required Strudel modules (including superdough)
		const [strudelCore, strudelDraw, strudelTranspiler, strudelWebaudio, strudelCodemirror] =
			await Promise.all([
				// @ts-expect-error -- no typedef
				import('@strudel/core'),

				// @ts-expect-error -- no typedef
				import('@strudel/draw'),

				// @ts-expect-error -- no typedef
				import('@strudel/transpiler'),

				// @ts-expect-error -- no typedef
				import('@strudel/webaudio'),

				// @ts-expect-error -- no typedef
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
			getTime: () => audioService.getAudioContext().currentTime,
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
				// Clean up globals to avoid polluting the rest of the app
				// These are only needed during synchronous pattern evaluation
				delete (globalThis as any).send;
				delete (globalThis as any).recv;
				delete (globalThis as any).onMessage;

				let attempts = 0;

				let itv = setInterval(() => {
					// @ts-expect-error -- hack from patching strudel
					const g = window.SuperdoughDestinationGain as GainNode;
					const outGain = audioService.getNodeById(nodeId)?.audioNode;

					if (g && outGain) {
						clearInterval(itv);

						// destination gain might already be disconnected.
						try {
							g.disconnect(audioService.getAudioContext().destination);
						} catch {}

						g.connect(outGain);
					} else if (attempts > 500) {
						logger.error('>> failed to hijack strudel output!');
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
		editor.setFontFamily(fontFamily);
		editor.setFontSize(fontSize);

		const keymaps = Prec.highest(
			keymap.of([
				{
					key: 'Shift-Enter',
					run: () => {
						onBeforeEvaluate?.();
						editor.evaluate();

						return true;
					}
				},
				{
					key: 'Mod-s',
					run: () => {
						onBeforeEvaluate?.();
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
