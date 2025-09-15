<script lang="ts">
	import type { InspectedMachine, Effect } from '$lib/assembly';
	import PaginatedMemoryViewer from './PaginatedMemoryViewer.svelte';

	interface Props {
		machineId: number;
		state?: InspectedMachine | null;
		error?: string | null;
		logs?: string[];
	}

	let { machineId, state, error, logs = [] }: Props = $props();

	// Derive status information
	const errored = $derived(state?.status === 'Errored');
	const awaiting = $derived(state?.status === 'Awaiting');
	const sleeping = $derived(state?.status === 'Sleeping');
	const halted = $derived(state?.status === 'Halted');
	const running = $derived(state?.status === 'Running');
	const ready = $derived(state?.status === 'Ready');
	const backpressuring = $derived((state?.inbox_size || 0) > 50);
	const sending = $derived((state?.outbox_size || 0) >= 1);

	function getStatusBadge(): string {
		if (errored) return 'bg-red-500/20 text-red-400';
		if (awaiting) return 'bg-purple-500/20 text-purple-400';
		if (sleeping) return 'bg-gray-500/20 text-gray-400';
		if (halted) return 'bg-gray-600/20 text-gray-500';
		if (running) return 'bg-green-500/20 text-green-400';
		if (ready) return 'bg-blue-500/20 text-blue-400';

		return 'bg-zinc-500/20 text-zinc-400';
	}
</script>

<div class="space-y-2 font-mono text-xs">
	<!-- Error Display -->
	{#if error}
		<div class="rounded border border-red-500/20 bg-red-500/10 px-2 py-1 text-red-400">
			❌ {error}
		</div>
	{/if}

	<!-- Effects/Logs Display -->
	{#if logs.length > 0}
		<div class="rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-cyan-400">
			{#each logs as log}
				<div>&gt; {log}</div>
			{/each}
		</div>
	{/if}

	<!-- Registers and State -->
	{#if state}
		<div class="rounded border border-zinc-700 bg-zinc-800/50 px-2 py-1">
			<div class="mb-1 flex items-center justify-between">
				<span class="text-zinc-300">Machine {machineId}</span>
				<span class="rounded px-1.5 py-0.5 text-xs {getStatusBadge()}">
					{state.status}
				</span>
			</div>

			<div class="flex gap-3 text-green-400">
				<div>
					<span class="text-zinc-400">PC</span>
					<strong class="ml-1">{state.registers.pc.toString().padStart(2, '0')}</strong>
				</div>

				<div>
					<span class="text-zinc-400">SP</span>
					<strong class="ml-1">{state.registers.sp}</strong>
				</div>

				<div>
					<span class="text-zinc-400">FP</span>
					<strong class="ml-1">{state.registers.fp}</strong>
				</div>
			</div>

			<!-- Inbox/Outbox indicators -->
			{#if state.inbox_size > 0 || state.outbox_size > 0}
				<div class="mt-1 flex gap-3">
					{#if state.inbox_size > 0}
						<div class="text-orange-400" class:text-red-400={backpressuring}>
							<span class="text-zinc-400">IB</span>
							<strong class="ml-1">{state.inbox_size}</strong>
						</div>
					{/if}

					{#if state.outbox_size > 0}
						<div class="text-blue-400">
							<span class="text-zinc-400">OB</span>
							<strong class="ml-1">{state.outbox_size}</strong>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Effects -->
			{#if state.effects && state.effects.length > 0}
				<div class="mt-2 space-y-1">
					<div class="text-xs text-zinc-400">Effects:</div>
					{#each state.effects as effect}
						<div class="pl-2 text-xs text-yellow-400">
							{#if effect.type === 'Print'}
								📝 {effect.text}
							{:else if effect.type === 'Sleep'}
								😴 Sleep {effect.ms}ms
							{:else}
								⚡ {JSON.stringify(effect)}
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<div class="rounded border border-zinc-700/50 bg-zinc-800/30 px-2 py-1 text-zinc-500">
			No machine state available
		</div>
	{/if}

	<!-- Memory Viewer -->
	{#if state}
		<div class="rounded border border-zinc-700 bg-zinc-800/50 px-2 py-1">
			<div class="mb-2 text-xs text-zinc-400">Memory:</div>
			<PaginatedMemoryViewer {machineId} />
		</div>
	{/if}
</div>
