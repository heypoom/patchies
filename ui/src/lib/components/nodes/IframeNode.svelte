<script lang="ts">
	import { Check, Edit, Globe, X } from '@lucide/svelte/icons';
	import { NodeResizer, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { shouldShowHandles, isConnecting } from '../../../stores/ui.store';
	import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
	import type { IframePostMessageEvent } from '$lib/eventbus/events';
	import { IframePostMessageListener } from '$lib/iframe/IframePostMessageListener';

	let node: {
		id: string;
		data: {
			url?: string;
			width?: number;
			height?: number;
		};
		selected: boolean;
		dragging: boolean;
		width: number;
		height: number;
	} = $props();

	const { updateNode } = useSvelteFlow();

	let messageContext: MessageContext;
	let urlInputRef: HTMLInputElement;
	let iframeRef: HTMLIFrameElement | undefined = $state();
	let showUrlInput = $state(false);
	let tempUrl = $state('');
	let isResizing = $state(false);

	const eventBus = PatchiesEventBus.getInstance();

	const DEFAULT_WIDTH = 400;
	const DEFAULT_HEIGHT = 300;

	const hasUrl = $derived(!!node.data.url);

	const handleMessage: MessageCallbackFn = (m) => {
		match(m)
			.with({ type: 'load', url: P.string }, ({ url }) => {
				loadUrl(url);
			})
			.otherwise((data) => {
				// Forward other messages into the iframe via postMessage
				iframeRef?.contentWindow?.postMessage(data, '*');
			});
	};

	function loadUrl(url: string) {
		updateNode(node.id, {
			data: {
				...node.data,
				url
			}
		});
		showUrlInput = false;
	}

	function handleUrlSubmit() {
		if (tempUrl.trim()) {
			loadUrl(tempUrl.trim());
			tempUrl = '';
		}
	}

	function handleUrlInputKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			handleUrlSubmit();
		} else if (event.key === 'Escape') {
			showUrlInput = false;
			tempUrl = '';
		}
	}

	function toggleUrlInput() {
		showUrlInput = !showUrlInput;
		if (showUrlInput) {
			tempUrl = node.data.url || '';
			setTimeout(() => {
				urlInputRef?.focus();
			}, 50);
		}
	}

	// Handle postMessage events from this iframe
	function handleIframePostMessage(event: IframePostMessageEvent) {
		// Check if the message came from our iframe
		if (!iframeRef?.contentWindow || event.source !== iframeRef.contentWindow) {
			return;
		}

		// Forward the message data to the outlet
		messageContext?.send(event.data);
	}

	onMount(() => {
		messageContext = new MessageContext(node.id);
		messageContext.queue.addCallback(handleMessage);

		// Initialize the global postMessage listener (singleton)
		IframePostMessageListener.getInstance();

		// Subscribe to iframe postMessage events
		eventBus.addEventListener('iframePostMessage', handleIframePostMessage);
	});

	onDestroy(() => {
		messageContext?.queue.removeCallback(handleMessage);
		messageContext?.destroy();
		eventBus.removeEventListener('iframePostMessage', handleIframePostMessage);
	});

	const handleCommonClass = $derived.by(() => {
		if (!node.selected && $shouldShowHandles) {
			return 'z-1 transition-opacity';
		}

		return `z-1 transition-opacity ${node.selected ? '' : 'sm:opacity-0 opacity-30 group-hover:opacity-100'}`;
	});
</script>

<div class="relative">
	<NodeResizer
		class="z-1"
		isVisible={node.selected}
		onResizeStart={() => (isResizing = true)}
		onResizeEnd={() => (isResizing = false)}
	/>

	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div
				class="group/header absolute -top-7 left-0 z-20 flex w-full items-center justify-between"
			>
				<div class="z-10 w-fit rounded-lg bg-zinc-900 px-2 py-1 text-nowrap whitespace-nowrap">
					<div class="font-mono text-xs font-medium text-zinc-400">iframe</div>
				</div>
			</div>

			<div class="relative">
				<StandardHandle
					port="inlet"
					type="message"
					total={1}
					index={0}
					class={handleCommonClass}
					nodeId={node.id}
				/>

				<div class="flex flex-col gap-2">
					{#if hasUrl}
						<div class="relative">
							<!-- we need pointer-events none on resize/drag/connect otherwise the mouse goes into iframe -->
							<iframe
								bind:this={iframeRef}
								src={node.data.url}
								title="iframe content"
								class="rounded-md border border-zinc-700 bg-white"
								style="width: {node.width ?? DEFAULT_WIDTH}px; height: {node.height ??
									DEFAULT_HEIGHT}px;{isResizing || node.dragging || $isConnecting
									? ' pointer-events: none;'
									: ''}"
								sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
								allow="geolocation; microphone; camera; midi; encrypted-media"
							></iframe>

							<button
								title="Change URL"
								class="absolute -top-2 -right-2 rounded-full border border-zinc-600 bg-zinc-800 p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
								onclick={toggleUrlInput}
							>
								<Edit class="h-3 w-3 text-zinc-300" />
							</button>
						</div>
					{:else}
						<div
							class="flex flex-col items-center justify-center gap-2 rounded-lg border-1 border-dashed border-zinc-600 bg-zinc-900 px-1 py-3"
							style="width: {node.width ?? DEFAULT_WIDTH}px; height: {node.height ??
								DEFAULT_HEIGHT}px"
							ondblclick={toggleUrlInput}
							role="button"
							tabindex="0"
							onkeydown={(e) => e.key === 'Enter' && toggleUrlInput()}
						>
							<Globe class="h-4 w-4 text-zinc-400" />

							<div class="px-2 text-center font-mono text-[12px] font-light text-zinc-400">
								<span class="text-zinc-300">double click</span> to<br />
								enter URL
							</div>
						</div>
					{/if}

					{#if showUrlInput}
						<div
							class="absolute top-0 left-0 z-20 flex w-full items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800 p-2 shadow-lg"
						>
							<input
								bind:this={urlInputRef}
								bind:value={tempUrl}
								type="text"
								placeholder="Enter URL (https://...)"
								class="flex-1 rounded border border-zinc-600 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none"
								onkeydown={handleUrlInputKeydown}
							/>
							<button
								title="Load URL"
								class="rounded bg-zinc-700 p-1 hover:bg-zinc-600"
								onclick={handleUrlSubmit}
							>
								<Check class="h-4 w-4 text-zinc-300" />
							</button>
							<button
								title="Cancel"
								class="rounded bg-zinc-700 p-1 hover:bg-zinc-600"
								onclick={() => {
									showUrlInput = false;
									tempUrl = '';
								}}
							>
								<X class="h-4 w-4 text-zinc-300" />
							</button>
						</div>
					{/if}
				</div>

				<StandardHandle
					port="outlet"
					type="message"
					title="postMessage output"
					total={1}
					index={0}
					class={handleCommonClass}
					nodeId={node.id}
				/>
			</div>
		</div>
	</div>
</div>
