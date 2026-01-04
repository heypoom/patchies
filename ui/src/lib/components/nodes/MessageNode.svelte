<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import Json5 from 'json5';

	import hljs from 'highlight.js/lib/core';
	import javascript from 'highlight.js/lib/languages/javascript';

	import 'highlight.js/styles/tokyo-night-dark.css';
	import CodeEditor from '../CodeEditor.svelte';

	hljs.registerLanguage('javascript', javascript);

	let {
		id: nodeId,
		data,
		selected
	}: { id: string; data: { message: string }; selected: boolean } = $props();

	const { updateNodeData } = useSvelteFlow();

	const messageContext = new MessageContext(nodeId);

	let showTextInput = $state(false);
	let msgText = $derived(data.message || '');

	const CANNOT_PARSE_SYMBOL = Symbol.for('CANNOT_PARSE');

	let parsedObject = $derived.by(() => {
		try {
			return Json5.parse(data.message);
		} catch {
			return CANNOT_PARSE_SYMBOL;
		}
	});

	// Fast heuristics to switch syntax highlighting modes.
	let shouldUseJsSyntax = $derived.by(() => {
		const msg = data.message ?? '';
		if (msg.length < 3) return false;

		return msg.startsWith('{') || msg.startsWith('[') || msg.startsWith(`'`) || msg.startsWith(`"`);
	});

	let highlightedHtml = $derived.by(() => {
		if (parsedObject === CANNOT_PARSE_SYMBOL || !msgText) return '';

		try {
			return hljs.highlight(msgText, {
				language: 'javascript',
				ignoreIllegals: true
			}).value;
		} catch (e) {
			return '';
		}
	});

	const handleMessage: MessageCallbackFn = (message) => {
		try {
			match(message)
				.with(P.union(null, undefined, { type: 'bang' }), () => {
					sendMessage();
				})
				.with({ type: 'set', value: P.any }, ({ value }) => {
					let newMsgText: string;
					if (typeof value === 'string') {
						newMsgText = value;
					} else {
						try {
							newMsgText = Json5.stringify(value, null, 2);
						} catch (e) {
							newMsgText = String(value);
						}
					}
					updateNodeData(nodeId, { message: newMsgText });
				});
		} catch (error) {
			console.error('MessageNode handleMessage error:', error);
		}
	};

	onMount(() => {
		messageContext.queue.addCallback(handleMessage);
	});

	onDestroy(() => {
		messageContext.queue.removeCallback(handleMessage);
		messageContext.destroy();
	});

	const send = (data: unknown) => messageContext.send(data);

	/**
	 * Send the message to connected objects.
	 *
	 * Message format:
	 * - Bare strings (e.g. `hello world`) are sent as symbols: `{ type: 'hello world' }`
	 * - Quoted strings (e.g. `"hello world"`) are sent as strings: `"hello world"`
	 * - JSON objects (e.g. `{ type: 'bang' }`) are sent as-is
	 * - Numbers (e.g. `100`) are sent as numbers
	 */
	function sendMessage() {
		// Try to parse as JSON5 (handles quoted strings, objects, numbers, etc.)
		try {
			send(Json5.parse(msgText));
			return;
		} catch (e) {}

		// Bare strings are treated as symbols: { type: <string> }
		send({ type: msgText });
	}

	const containerClass = $derived(
		selected ? 'object-container-selected' : 'object-container-light'
	);
</script>

<div class="relative">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div></div>
				<button
					class="rounded p-1 transition-opacity hover:bg-zinc-700 group-hover:opacity-100 sm:opacity-0"
					onclick={() => (showTextInput = !showTextInput)}
					title="Toggle Message Input"
				>
					<Icon
						icon={showTextInput ? 'lucide:chevron-up' : 'lucide:edit'}
						class="h-4 w-4 text-zinc-300"
					/>
				</button>
			</div>

			<div class="relative">
				<StandardHandle port="inlet" type="message" total={1} index={0} />

				<div class="relative">
					{#if showTextInput}
						<div
							class={[
								'nodrag w-full min-w-[40px] resize-none rounded-lg border font-mono text-zinc-200',
								containerClass
							]}
						>
							<CodeEditor
								value={msgText}
								onchange={(value) => updateNodeData(nodeId, { message: value })}
								onrun={sendMessage}
								language={shouldUseJsSyntax ? 'javascript' : 'plain'}
								class="message-node-code-editor rounded-lg border !border-transparent focus:outline-none"
							/>
						</div>
					{:else}
						<button
							onclick={sendMessage}
							class={[
								'send-message-button whitespace-pre rounded-lg border px-3 py-2 text-start text-xs font-medium text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50',
								containerClass
							]}
						>
							{#if msgText && parsedObject !== CANNOT_PARSE_SYMBOL && typeof parsedObject !== 'number'}
								<code class="whitespace-pre">
									{@html highlightedHtml}
								</code>
							{:else if msgText && typeof parsedObject === 'number'}
								<span class="text-gray-200">{msgText}</span>
							{:else}
								<span class="text-purple-300">{msgText ? msgText : '<messagebox>'}</span>
							{/if}
						</button>
					{/if}
				</div>

				<StandardHandle port="outlet" type="message" total={1} index={0} />
			</div>
		</div>
	</div>
</div>

<style>
	:global(.message-node-code-editor .cm-content) {
		padding: 6px 8px 7px 4px !important;
	}

	.send-message-button {
		font-family:
			Monaco,
			Menlo,
			Ubuntu Mono,
			Consolas,
			source-code-pro,
			monospace;
	}
</style>
