<script lang="ts">
	import { CircleAlert, Info, TriangleAlert } from '@lucide/svelte/icons';

	let {
		msg
	}: {
		msg: { type: string; args: unknown[] };
	} = $props();

	const typeStyles = {
		log: {
			text: 'text-zinc-100',
			bg: '',
			icon: Info,
			iconColor: 'text-blue-400'
		},
		warn: {
			text: 'text-amber-200',
			bg: 'bg-amber-950/30 border-l-2 border-amber-600',
			icon: TriangleAlert,
			iconColor: 'text-amber-500'
		},
		error: {
			text: 'text-red-300',
			bg: 'bg-red-950/30 border-l-2 border-red-600',
			icon: CircleAlert,
			iconColor: 'text-red-500'
		},
		debug: {
			text: 'text-zinc-500',
			bg: 'bg-zinc-900/30 border-l-2 border-zinc-700/40',
			icon: Info,
			iconColor: 'text-zinc-600'
		}
	};

	const style = $derived(typeStyles[msg.type as keyof typeof typeStyles] || typeStyles.log);

	function formatArg(arg: unknown): string {
		if (arg === null) return 'null';
		if (arg === undefined) return 'undefined';

		const type = typeof arg;

		if (type === 'string') return String(arg);
		if (type === 'number' || type === 'boolean') return String(arg);

		// For objects and arrays, use JSON.stringify with pretty printing
		try {
			return JSON.stringify(arg, null, 2);
		} catch {
			return String(arg);
		}
	}
</script>

<div
	class={[
		'flex items-start gap-1.5 px-2 py-1 whitespace-pre-wrap select-text',
		style.text,
		style.bg
	].join(' ')}
>
	{#if msg.type === 'error' || msg.type === 'warn' || msg.type === 'debug'}
		<svelte:component
			this={style.icon}
			class={['mt-0.5 flex-shrink-0', style.iconColor].join(' ')}
			size={14}
		/>
	{/if}
	<div class="flex-1">
		{#each msg.args as arg, i}{#if i > 0}{/if}<span>{formatArg(arg)}</span>{/each}
	</div>
</div>
