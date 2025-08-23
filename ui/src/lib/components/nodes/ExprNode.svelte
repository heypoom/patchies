<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { isBackgroundOutputCanvasEnabled } from '../../../stores/canvas.store';
	import { match, P } from 'ts-pattern';

	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: { expr: string; inletCount: number };
		selected: boolean;
	} = $props();

	const { updateNodeData, deleteElements } = useSvelteFlow();

	let inputElement = $state<HTMLInputElement>();
	let nodeElement = $state<HTMLDivElement>();
	let expr = $state(data.expr || '');
	let isEditing = $state(!data.expr); // Start in editing mode if no expression
	let originalExpr = data.expr || ''; // Store original for escape functionality
	let inletValues = $state<(string | number)[]>([]);

	const messageContext = new MessageContext(nodeId);

	// Parse expression to find $1, $2, etc. and determine inlet count
	const parseExpression = (expression: string): { inletCount: number } => {
		const dollarVarPattern = /\$(\d+)/g;
		const matches = [...expression.matchAll(dollarVarPattern)];
		const maxVar = Math.max(0, ...matches.map((match) => parseInt(match[1])));
		const inletCount = maxVar > 0 ? maxVar : 1; // At least 1 inlet

		return { inletCount };
	};

	const { inletCount } = $derived.by(() => {
		if (!expr.trim()) return { inletCount: 1 };
		return parseExpression(expr.trim());
	});

	// Create evaluation function
	const createEvalFunction = (expression: string) => {
		if (!expression.trim()) return null;

		try {
			// Create parameter names $1, $2, ..., $9
			const args = [...Array(9)].map((_, i) => `$${i + 1}`);

			// Create the function with safety checks.
			// Expose math functions as globals.
			const fnBody = `
				try {
					with (Math) {
						return ${expression || '0'};
					}
				} catch (e) {
					throw new Error('Expression evaluation failed: ' + e.message);
				}
			`;

			return new Function(...args, fnBody);
		} catch (error) {
			console.error('Failed to create eval function:', error);
			return null;
		}
	};

	const evalFunction = $derived.by(() => createEvalFunction(expr));

	// Handle incoming messages
	const handleMessage: MessageCallbackFn = (message, meta) => {
		const nextInletValues = [...inletValues];

		match(message)
			.with({ type: 'bang' }, () => {})
			.with(P.union(P.number, P.string), (value) => {
				if (meta?.inlet === undefined) return;

				nextInletValues[meta.inlet] = value;
				inletValues = nextInletValues;
			});

		// Evaluate expression and send result
		if (evalFunction) {
			try {
				const args = [...Array(9)].map((_, i) => nextInletValues[i] ?? 0);
				const result = evalFunction(...args);

				messageContext.send(result);
			} catch (error) {
				console.error(`Expression evaluation error in ${nodeId}:`, error);
			}
		}
	};

	function enterEditingMode() {
		isEditing = true;
		originalExpr = expr;

		// Focus input on next tick
		setTimeout(() => inputElement?.focus(), 10);
	}

	function exitEditingMode(save: boolean = true) {
		isEditing = false;

		if (!save) {
			// Restore original expression on escape
			expr = originalExpr;

			// If the original expression was empty, delete the node
			if (!originalExpr.trim()) {
				deleteElements({ nodes: [{ id: nodeId }] });
				return;
			}
		}

		if (save) {
			if (expr.trim()) {
				updateNodeData(nodeId, {
					...data,
					expr: expr.trim(),
					inletCount
				});
			} else {
				// If trying to save with empty expression, delete the node
				deleteElements({ nodes: [{ id: nodeId }] });
			}
		}

		// Restore focus to the node element after editing
		setTimeout(() => nodeElement?.focus(), 0);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!isEditing) return;

		if (event.key === 'Escape') {
			event.preventDefault();
			exitEditingMode(false);
			return;
		}

		if (event.key === 'Enter') {
			event.preventDefault();
			exitEditingMode(true);
		}
	}

	function handleBlur() {
		if (!isEditing) return;

		// Delay to allow other events to process
		setTimeout(() => {
			if (!expr.trim()) {
				deleteElements({ nodes: [{ id: nodeId }] });
			} else {
				exitEditingMode(true);
			}
		}, 100);
	}

	function handleDoubleClick() {
		if (!isEditing) {
			enterEditingMode();
		}
	}

	const borderColor = $derived(selected ? 'border-zinc-400' : 'border-zinc-700');

	onMount(() => {
		if (isEditing) {
			setTimeout(() => inputElement?.focus(), 10);
		}

		messageContext.queue.addCallback(handleMessage);

		// Initialize inlet values array
		inletValues = new Array(inletCount).fill(0);
	});

	onDestroy(() => {
		messageContext.queue.removeCallback(handleMessage);
		messageContext.destroy();
	});
</script>

<div class="relative">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="relative">
				<!-- Dynamic inlets based on expression -->
				{#each Array.from({ length: inletCount }) as _, index}
					<Handle
						type="target"
						position={Position.Top}
						id={`inlet-${index}`}
						class="z-1 top-0"
						style={`left: ${inletCount === 1 ? '50%' : `${35 + (index / (inletCount - 1)) * 30}%`}`}
						title={`$${index + 1}`}
					/>
				{/each}

				<div class="relative">
					{#if isEditing}
						<!-- Editing state: show input field -->
						<div class={['w-fit rounded-lg border bg-zinc-900/80 backdrop-blur-lg', borderColor]}>
							<input
								bind:this={inputElement}
								bind:value={expr}
								onblur={handleBlur}
								onkeydown={handleKeydown}
								placeholder="$1 + 2"
								class="nodrag min-w-24 bg-transparent px-3 py-2 font-mono text-xs text-zinc-200 placeholder-zinc-500 outline-none"
							/>
						</div>
					{:else}
						<!-- Display state: show expression -->
						<div
							bind:this={nodeElement}
							class={[
								'w-full min-w-16 cursor-pointer rounded-lg border bg-zinc-900/80 px-3 py-2 backdrop-blur-lg',
								borderColor
							]}
							ondblclick={handleDoubleClick}
							role="button"
							tabindex="0"
							onkeydown={(e) => e.key === 'Enter' && handleDoubleClick()}
						>
							<div class="font-mono text-xs text-zinc-200">
								{#if expr.trim()}
									{expr}
								{:else}
									<span class="text-zinc-500">expr</span>
								{/if}
							</div>
						</div>
					{/if}
				</div>

				<!-- Single outlet -->
				<Handle type="source" position={Position.Bottom} class="z-1" title="Result" />
			</div>
		</div>
	</div>
</div>
