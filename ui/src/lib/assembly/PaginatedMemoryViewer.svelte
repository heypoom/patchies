<script lang="ts">
	import MemoryViewer from './MemoryViewer.svelte';
	import { memoryActions, getMemoryConfig, getMemoryPage, getMemoryRange } from './memoryStore';
	import { memoryRegionStore } from './memoryRegionStore';
	import { AssemblySystem } from './AssemblySystem';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';

	interface Props {
		machineId: number;
	}

	let { machineId }: Props = $props();

	let highlightedAddr = $state<number | null>(null);
	let isEditOffset = $state(false);
	let offsetInput = $state('');

	const hex = true;
	const minDigits = 4;
	const base = hex ? 16 : 10;
	const pad = hex ? minDigits : minDigits + 1;

	// Get reactive stores for this machine
	const memoryConfig = getMemoryConfig(machineId);
	const memoryPage = getMemoryPage(machineId);
	const memoryRange = getMemoryRange(machineId);

	// Computed values from stores
	const memStart = $derived($memoryRange.start);
	const memEnd = $derived($memoryRange.end);
	const memory = $derived($memoryPage);

	// Get memory regions for this machine (reactive)
	const regions = $derived($memoryRegionStore[machineId] || []);

	function show(n: number): string {
		return `${hex ? '0x' : ''}${n.toString(base).padStart(pad, '0').toUpperCase()}`;
	}

	function prevPage() {
		memoryActions.prevPage(machineId);
	}

	function nextPage() {
		memoryActions.nextPage(machineId);
	}

	function gotoDefaultPage() {
		memoryActions.gotoDefaultPage(machineId);
	}

	function handleOffsetEdit() {
		isEditOffset = false;
		const offset = parseInt(offsetInput, base);

		if (!isNaN(offset)) {
			const pageSize = $memoryRange.size;
			const page = Math.floor(offset / pageSize);
			memoryActions.setPage(machineId, page);
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			handleOffsetEdit();
		}
	}

	function onConfirm(start: number, end: number): boolean {
		// In a full implementation, this would handle region selection
		// For now, just return false to indicate no special handling
		return false;
	}

	function onDrag(transfer: DataTransfer, start: number, end: number) {
		// Set up drag data for creating asm.value nodes
		const selectionSize = end - start + 1;
		// Randomize color from palette when dragging
		const randomColor = Math.floor(Math.random() * 9); // 9 colors in regionPalettes
		const dragData = {
			machineId,
			address: memStart + start,
			size: selectionSize, // Use actual selection size
			format: 'hex',
			signed: false,
			color: randomColor
		};

		transfer.effectAllowed = 'copy';
		transfer.setData('application/asm-memory', JSON.stringify(dragData));
	}

	// Load initial memory page when component mounts
	$effect(() => {
		memoryActions.loadMemoryPage(machineId);
	});

	// Update offset input when editing starts
	$effect(() => {
		if (isEditOffset) {
			offsetInput = show(memStart);
		}
	});
</script>

{#if memory.length > 0}
	<div class="flex w-fit flex-col gap-y-1">
		<MemoryViewer
			{memory}
			begin={memStart}
			onHover={(addr) => (highlightedAddr = addr)}
			{onConfirm}
			{onDrag}
			{regions}
		/>

		<div class="mt-1 flex items-center justify-between px-2 text-xs">
			<!-- Previous page button -->
			<button
				onclick={prevPage}
				class="nodrag cursor-pointer text-zinc-500 hover:text-red-400"
				class:invisible={memStart === 0}
				disabled={memStart === 0}
			>
				<ArrowLeft  />
			</button>

			<!-- Address range display -->
			{#if highlightedAddr === null}
				<div class="flex gap-x-1 text-xs text-zinc-500">
					{#if isEditOffset}
						<!-- svelte-ignore a11y_autofocus -->
						<input
							bind:value={offsetInput}
							onkeydown={handleKeyDown}
							class="w-16 rounded-sm border border-zinc-600 bg-transparent px-1 text-zinc-200 outline-0 outline-zinc-600 focus:border-green-400"
							placeholder={show(memStart)}
							autofocus
						/>
					{:else}
						<button
							onclick={() => (isEditOffset = true)}
							class="nodrag cursor-pointer hover:text-zinc-200"
						>
							{show(memStart)}
						</button>
					{/if}

					<div>-</div>

					<button onclick={gotoDefaultPage} class="nodrag cursor-pointer hover:text-zinc-200">
						{show(memEnd)}
					</button>
				</div>
			{:else}
				<div class=" text-red-300">
					{show(highlightedAddr)}
				</div>
			{/if}

			<!-- Next page button -->
			<button onclick={nextPage} class="nodrag cursor-pointer text-zinc-500 hover:text-red-400">
				<ArrowRight  />
			</button>
		</div>
	</div>
{/if}
