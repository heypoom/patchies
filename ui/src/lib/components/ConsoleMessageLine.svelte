<script lang="ts">
	import { CircleAlert, Info, TriangleAlert } from '@lucide/svelte/icons';

	import ObjectInspector from './ObjectInspector.svelte';

	let {
		msg
	}: {
		msg: { type: string; args: unknown[] };
	} = $props();

	const typeStyles = {
		log: {
			text: 'text-zinc-100',
			bg: '',
			icon: null,
			iconColor: null
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
		},
		info: {
			text: 'text-zinc-100',
			bg: 'bg-zinc-700/30 border-l-2 border-zinc-700/40',
			icon: Info,
			iconColor: 'text-zinc-500'
		}
	};

	const style = $derived(typeStyles[msg.type as keyof typeof typeStyles] || typeStyles.log);

	function isInspectable(arg: unknown): boolean {
		if (arg === null || arg === undefined) return false;
		const type = typeof arg;
		return type === 'object' || type === 'function';
	}

	function formatArg(arg: unknown): string {
		if (arg === null) return 'null';
		if (arg === undefined) return 'undefined';

		const type = typeof arg;

		if (type === 'string') return String(arg);
		if (type === 'number' || type === 'boolean') return String(arg);
		if (type === 'function') return arg.toString();

		// For objects and arrays, this shouldn't be called (we use inspector)
		// But as fallback, use JSON.stringify
		try {
			return JSON.stringify(arg, null, 2);
		} catch {
			return String(arg);
		}
	}
</script>

<div class={['flex items-start gap-1.5 px-2 py-1 select-text', style.text, style.bg].join(' ')}>
	{#if style.icon}
		{@const IconComponent = style.icon}
		<IconComponent class={['mt-0.5 flex-shrink-0', style.iconColor].join(' ')} size={14} />
	{/if}

	<div class="console-content mt-[1px] min-w-0 flex-1">
		<div class="flex flex-col items-start gap-x-2">
			{#each msg.args as arg, i}
				{#if isInspectable(arg)}
					<ObjectInspector data={arg} />
				{:else}
					<span class="break-words whitespace-pre-wrap">{formatArg(arg)}</span>
				{/if}
			{/each}
		</div>
	</div>
</div>
