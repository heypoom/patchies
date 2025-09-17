<script lang="ts">
	import type { InspectedMachine, Effect } from '$lib/assembly';

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
		if (errored) return 'text-red-400';
		if (awaiting) return 'text-purple-400';
		if (backpressuring) return 'text-orange-400';
		if (sending) return 'text-blue-400';
		if (sleeping) return 'text-gray-400';
		if (halted) return 'text-gray-500';
		if (running) return 'text-green-400';
		if (ready) return 'text-blue-400';

		return '';
	}
</script>

<div class={['flex flex-col gap-1 px-1 font-mono text-xs']}>
	<div
		class={[
			'absolute right-4 top-2 rounded-sm bg-zinc-900/80 px-1 py-0.5 font-mono text-[10px] lowercase',
			getStatusBadge()
		]}
	>
		{state?.status}
	</div>

	<!-- Error Display -->
	{#if error}
		<div
			class="my-1 whitespace-pre rounded border border-red-500/20 bg-red-500/10 px-2 py-1 text-red-400"
		>
			{error}
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
		<div class="bg-transparent">
			<div class="flex gap-3 font-mono text-green-400">
				<div>
					<span class="text-[10px] text-zinc-400">ID</span>
					<span>{machineId}</span>
				</div>

				<div>
					<span class="text-[10px] text-zinc-400">PC</span>
					<span>{state.registers.pc.toString().padStart(2, '0')}</span>
				</div>

				<div>
					<span class="text-[10px] text-zinc-400">SP</span>
					<span>{state.registers.sp}</span>
				</div>

				<div>
					<span class="text-[10px] text-zinc-400">FP</span>
					<span>{state.registers.fp}</span>
				</div>

				<!-- Inbox -->
				{#if state.inbox_size > 0}
					<div class="text-orange-400" class:text-red-400={backpressuring}>
						<span class="text-[10px] text-zinc-400">IB</span>
						<span class="ml-1">{state.inbox_size}</span>
					</div>
				{/if}

				<!-- Outbox -->
				{#if state.outbox_size > 0}
					<div class="text-blue-400">
						<span class="text-[10px] text-zinc-400">OB</span>
						<span class="ml-1">{state.outbox_size}</span>
					</div>
				{/if}
			</div>

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
	{/if}
</div>
