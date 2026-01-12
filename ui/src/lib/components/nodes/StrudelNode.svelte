<script lang="ts">
	import { Play, Square, Terminal } from '@lucide/svelte/icons';
	import { useSvelteFlow } from '@xyflow/svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import VirtualConsole from '$lib/components/VirtualConsole.svelte';
	import { onMount, onDestroy } from 'svelte';
	import StrudelEditor from '$lib/components/StrudelEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { createCustomConsole } from '$lib/utils/createCustomConsole';

	// Get node data from XY Flow - nodes receive their data as props
	let { id: nodeId, data }: { id: string; data: { code: string; showConsole?: boolean } } =
		$props();

	// Get flow utilities to update node data
	const { updateNodeData } = useSvelteFlow();

	let strudelEditor: StrudelEditor | null = null;
	let messageContext: MessageContext;
	let consoleRef: VirtualConsole | null = $state(null);
	let hasError = $state(false);
	let isPlaying = $state(false);
	let isInitialized = $state(false);

	const code = $derived(data.code || '');
	const customConsole = createCustomConsole(nodeId);

	const setCode = (newCode: string) => {
		updateNodeData(nodeId, { code: newCode });
		strudelEditor?.editor?.setCode(newCode);
	};

	const handleMessage: MessageCallbackFn = (message) => {
		try {
			match(message)
				.with(P.string, (code) => {
					setCode(code);
				})
				.with({ type: 'set', code: P.string }, ({ code }) => {
					setCode(code);
				})
				.with(P.union({ type: 'bang' }, { type: 'run' }), evaluate)
				.with({ type: 'stop' }, stop);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			customConsole.error(errorMsg);
			hasError = true;
		}
	};

	// Listen for Strudel log events (errors come through CustomEvent)
	function handleStrudelLog(event: Event) {
		const detail = (event as CustomEvent).detail;
		if (detail?.type === 'error') {
			customConsole.error(detail.message);
			hasError = true;
		} else if (detail?.message) {
			customConsole.log(detail.message);
		}
	}

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);

		// Listen for Strudel's log events
		document.addEventListener('strudel.log', handleStrudelLog);

		// Wait for the StrudelEditor to be ready
		setTimeout(() => {
			if (strudelEditor?.editor) {
				isInitialized = true;

				// @ts-expect-error -- for debugging
				window.strudel = strudelEditor.editor;
			}
		}, 1000);
	});

	onDestroy(() => {
		stop();
		document.removeEventListener('strudel.log', handleStrudelLog);

		if (messageContext) {
			messageContext.queue.removeCallback(handleMessage);
			messageContext.destroy();
		}
	});

	function stop() {
		if (strudelEditor?.editor) {
			try {
				strudelEditor.editor.stop();
				isPlaying = false;
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				customConsole.error(errorMsg);
				hasError = true;
			}
		}
	}

	function evaluate() {
		if (strudelEditor?.editor) {
			// Clear previous errors on new evaluation
			consoleRef?.clearConsole();
			hasError = false;

			try {
				strudelEditor.editor.evaluate();
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				customConsole.error(errorMsg);
				hasError = true;
				isPlaying = false;
			}
		}
	}

	function handleUpdateState(state: any) {
		isPlaying = state.started;
	}
</script>

<div class="relative flex flex-row gap-2">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
					<div class="font-mono text-xs font-medium text-zinc-400">strudel</div>
				</div>

				<div class="flex items-center gap-1">
					<!-- Console toggle button -->
					<button
						class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
						onclick={() => updateNodeData(nodeId, { showConsole: !data.showConsole })}
						title="Toggle Console"
					>
						<Terminal class="h-4 w-4 text-zinc-300" />
					</button>

					<!-- Play/Stop button -->
					{#if isInitialized}
						{#if isPlaying}
							<button
								class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
								onclick={stop}
								title="Stop"
							>
								<Square class="h-4 w-4 text-zinc-300" />
							</button>
						{:else}
							<button
								class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
								onclick={evaluate}
								title="Play"
							>
								<Play class="h-4 w-4 text-zinc-300" />
							</button>
						{/if}
					{/if}
				</div>
			</div>

			<div class="relative">
				<StandardHandle
					port="inlet"
					type="message"
					id={nodeId}
					total={1}
					index={0}
					class="nodrag !-top-2"
					{nodeId}
				/>

				<div
					class={[
						'flex w-full items-center justify-center rounded-md border bg-zinc-900',
						hasError ? 'border-red-500' : 'border-transparent'
					]}
				>
					<div class="nodrag">
						<StrudelEditor
							{code}
							bind:this={strudelEditor}
							onUpdateState={handleUpdateState}
							onchange={(newCode) => {
								updateNodeData(nodeId, { code: newCode });
							}}
							class="w-full"
							{nodeId}
							{messageContext}
							{customConsole}
						/>
					</div>
				</div>

				<StandardHandle
					port="outlet"
					type="audio"
					total={2}
					index={0}
					class="!-bottom-2"
					{nodeId}
				/>

				<StandardHandle
					port="outlet"
					type="message"
					total={2}
					index={1}
					class="!-bottom-2"
					{nodeId}
				/>
			</div>
		</div>
	</div>

	<!-- Virtual Console (right side) -->
	<div class:hidden={!data.showConsole}>
		<VirtualConsole
			bind:this={consoleRef}
			{nodeId}
			onrun={evaluate}
			placeholder="Strudel logs and errors will appear here."
			shouldAutoShowConsoleOnError
		/>
	</div>
</div>
