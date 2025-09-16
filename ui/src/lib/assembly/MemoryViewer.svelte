<script lang="ts">
	import { onMount } from 'svelte';

	interface MemoryRegion {
		id: number;
		offset: number;
		size: number;
		color?: string;
	}

	interface ViewerConfig {
		hex?: boolean;
		showAddress?: boolean;
		minDigits?: number;
		columns?: number;
		rows?: number;
	}

	interface Props {
		memory: number[];
		begin?: number;
		full?: boolean;
		config?: ViewerConfig;
		onHover?: (address: number | null) => void;
		onConfirm?: (start: number, end: number) => boolean;
		onDrag?: (transfer: DataTransfer, start: number, end: number) => void;
		regions?: MemoryRegion[];
	}

	let {
		memory,
		begin = 0,
		config,
		full = false,
		onHover,
		onConfirm,
		onDrag,
		regions = []
	}: Props = $props();

	const { columns = 8, rows = 8, hex = true, showAddress = false, minDigits = 4 } = config ?? {};

	let start = $state<number | null>(null);
	let end = $state<number | null>(null);
	let selecting = $state(false);
	let canDragOut = $state(false);
	let aborted = false;

	const HOLD_MS = 100;

	// Computed values
	const base = hex ? 16 : 10;
	const pad = hex ? minDigits : minDigits + 1;
	const hasSelection = $derived(start !== null && end !== null && !selecting);

	const activeRegions = $derived(() => {
		const memoryEnd = begin + memory.length;
		return regions.filter((r) => r.offset >= begin && r.offset + r.size <= memoryEnd);
	});

	function show(n: number): string {
		return n.toString(base).padStart(pad, '0').toUpperCase();
	}

	function deselect() {
		start = null;
		end = null;
	}

	function startDrag(i: number) {
		aborted = false;

		setTimeout(() => {
			if (aborted) return;

			start = i;
			end = null;
			selecting = true;
		}, HOLD_MS);
	}

	function confirm() {
		selecting = false;

		if (onConfirm && start !== null && end !== null) {
			if (onConfirm(start, end)) deselect();
		}
	}

	function getRegionClassName(region: MemoryRegion) {
		return region.color
			? `bg-${region.color}-500/20 text-${region.color}-400`
			: 'bg-blue-500/20 text-blue-400';
	}

	function handleMouseDown(e: MouseEvent, i: number) {
		if (e.altKey && start !== null && end !== null && i >= start && i <= end) {
			canDragOut = true;
			return;
		}

		canDragOut = false;
		startDrag(i);
	}

	function handleMouseOver(i: number) {
		if (onHover) {
			onHover(begin + i);
		}

		if (selecting && start !== null) {
			if (i > start) {
				end = i;
			}
		}
	}

	function handleMouseUp() {
		confirm();
		aborted = true;
	}

	function handleMouseLeave() {
		canDragOut = false;
		if (selecting) confirm();
		if (onHover) onHover(null);
	}

	function handleDragStart(event: DragEvent) {
		if (start !== null && end !== null && onDrag) {
			onDrag(event.dataTransfer!, start, end);
		}
	}

	function handleDragEnd(e: DragEvent) {
		canDragOut = false;
		// Deselect on success
		if (e.dataTransfer?.dropEffect === 'copy') deselect();
	}

	// Handle keyboard events for Alt key
	onMount(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === 'Alt' && hasSelection) {
				canDragOut = true;
			}
		}

		function handleKeyUp(e: KeyboardEvent) {
			if (e.key === 'Alt') {
				canDragOut = false;
			}
		}

		document.addEventListener('keydown', handleKeyDown);
		document.addEventListener('keyup', handleKeyUp);

		return () => {
			document.removeEventListener('keydown', handleKeyDown);
			document.removeEventListener('keyup', handleKeyUp);
		};
	});

	// Deselect when begin changes
	$effect(() => {
		deselect();
	});
</script>

{#if memory?.length}
	<div class="flex text-xs">
		{#if showAddress}
			<div class="flex flex-col text-zinc-500">
				{#each Array.from({ length: rows }) as _, n}
					<div>
						{hex ? '0x' : ''}{show(begin + n * columns)}
					</div>
				{/each}
			</div>
		{/if}

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="nodrag grid bg-zinc-900"
			class:w-full={full}
			style="grid-template-columns: repeat({columns}, minmax(0, 1fr));"
			onmouseleave={handleMouseLeave}
			draggable={canDragOut}
			ondragstart={handleDragStart}
			ondragend={handleDragEnd}
		>
			{#each memory as u, i}
				{@const value = show(u)}
				{@const selected = start !== null && end !== null && i >= start && i <= end}

				{@const highlighted = activeRegions().find((r) => {
					const offset = r.offset - begin;
					return i >= offset && i < offset + r.size;
				})}

				<!-- svelte-ignore a11y_mouse_events_have_key_events -->
				<div
					onmousedown={(e) => handleMouseDown(e, i)}
					onmouseover={() => handleMouseOver(i)}
					onmouseup={handleMouseUp}
					class="cursor-pointer select-none bg-zinc-900 px-1 text-red-400 {highlighted
						? getRegionClassName(highlighted)
						: ''}"
					class:text-zinc-600={!selected && !highlighted && u === 0}
					class:bg-yellow-400={!canDragOut && selected}
					class:text-yellow-500={!canDragOut && selected}
					class:hover:text-yellow-600={!canDragOut && selected}
					class:hover:text-red-300={!canDragOut && !selected}
					class:bg-red-400={canDragOut && selected}
					class:text-red-500={canDragOut && selected}
					class:hover:text-red-600={canDragOut && selected}
					class:text-center={full}
					class:opacity-0={canDragOut && !selected}
					class:bg-transparent={canDragOut && !selected}
				>
					{value}
				</div>
			{/each}
		</div>
	</div>
{/if}
